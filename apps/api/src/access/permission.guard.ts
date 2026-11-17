import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALL_PERMISSIONS, idSchema, permissionScope, type Permission } from '@vm-web/shared';
import { ProblemException } from '../common/problem-details/problem.exception';
import {
  ADMIN_KEY,
  PERMISSION_KEY,
  type AuthenticatedRequest,
  type EnsembleSource,
  type PermissionRequirement,
} from './decorators';
import { EnsembleResolvers } from './ensemble-resolvers';

type Location = 'param' | 'body' | 'query';
const POINTER_PREFIX: Record<Location, string> = { param: '/params/', body: '/body/', query: '/query/' };

function readSource(req: AuthenticatedRequest, source: `${Location}:${string}`): string {
  const [location, key] = source.split(':') as [Location, string];
  const container: Record<string, unknown> | undefined =
    location === 'param' ? req.params : location === 'body' ? req.body : (req.query as Record<string, unknown>);
  const value = container?.[key];
  if (!idSchema.safeParse(value).success) {
    throw ProblemException.validation([
      { path: POINTER_PREFIX[location] + key, code: value === undefined ? 'invalid_type' : 'invalid_format' },
    ]);
  }
  return value as string;
}

/**
 * Second global guard: evaluates `@RequirePermission` against the caller's `AccessContext` (R-2..R-6).
 * For elements of an ensemble the caller cannot even see (`<area>.view` missing) it answers 404, otherwise 403.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(EnsembleResolvers) private readonly resolvers: EnsembleResolvers,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(PERMISSION_KEY, targets);
    const adminOnly = this.reflector.getAllAndOverride<boolean | undefined>(ADMIN_KEY, targets);
    if (!requirement && !adminOnly) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const access = req.vmweb?.access;
    if (!access) throw ProblemException.unauthenticated();
    if (access.isAdmin) return true;
    if (adminOnly || !requirement) throw ProblemException.forbidden('Admin flag required');

    const needsEnsemble = requirement.anyOf.some((p) => permissionScope(p) === 'ensemble');
    const ensembleId = needsEnsemble ? await this.resolveEnsemble(req, requirement.ensembleFrom) : undefined;

    if (requirement.anyOf.some((p) => access.has(p, ensembleId))) return true;

    if (ensembleId && !this.canSeeAny(requirement.anyOf, (p) => access.has(p, ensembleId))) {
      throw ProblemException.notFound();
    }
    throw ProblemException.forbidden();
  }

  private async resolveEnsemble(req: AuthenticatedRequest, source: EnsembleSource | undefined): Promise<string> {
    if (!source) throw new Error('@RequirePermission with ensemble scope needs ensembleFrom');
    if (typeof source === 'string') return readSource(req, source);
    const ensembleId = await this.resolvers.get(source.resolver)(readSource(req, source.from));
    if (!ensembleId) throw ProblemException.notFound();
    return ensembleId;
  }

  /** Whether the caller holds `<area>.view` for any required permission's area. */
  private canSeeAny(permissions: Permission[], has: (p: Permission) => boolean): boolean {
    return permissions.some((p) => {
      const view = `${p.split('.')[0]}.view` as Permission;
      return !ALL_PERMISSIONS.includes(view) || has(view);
    });
  }
}
