import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission } from '@vm-web/shared';
import type { Request } from 'express';
import type { AccessContext } from './access-context';
import type { AccessUser } from './access.repository';
import type { SessionData } from './session.store';

export const PUBLIC_KEY = 'vmweb:public';
export const PERMISSION_KEY = 'vmweb:permission';

export interface PublicOptions {
  /** Answer a session of a blocked account with 403 `account-blocked` instead of ignoring it (auth/session). */
  reportBlocked?: boolean;
}

/** Reachable without session; CSRF is not checked. */
export const Public = (options: PublicOptions = {}) => SetMetadata(PUBLIC_KEY, options);

/**
 * Where the ensemble of a check with scope `ensemble` comes from:
 * - `'param:ensembleId'`, `'body:ensembleId'`, `'query:ensembleId'`
 * - a resolver that loads it from an element, e.g. a folder; `null` → 404 `not-found`.
 */
export type EnsembleSource =
  | `param:${string}`
  | `body:${string}`
  | `query:${string}`
  | { resolver: EnsembleResolverToken; from: `param:${string}` | `body:${string}` | `query:${string}` };

/** Name of a registered `EnsembleResolver` (see `ENSEMBLE_RESOLVERS`). */
type EnsembleResolverToken = string;

export interface PermissionRequirement {
  /** Any of these permissions is enough. */
  anyOf: Permission[];
  ensembleFrom?: EnsembleSource;
}

/**
 * Requires a permission; its scope (ensemble / any-ensemble / club) comes from the permission code.
 * Several permissions: any of them is enough.
 *
 * @example
 * @RequirePermission('folder.create', { ensembleFrom: 'body:ensembleId' })
 * @RequirePermission(['score.edit', 'config.edit'])
 */
export const RequirePermission = (
  permission: Permission | Permission[],
  options: { ensembleFrom?: EnsembleSource } = {},
) =>
  SetMetadata(PERMISSION_KEY, {
    anyOf: Array.isArray(permission) ? permission : [permission],
    ensembleFrom: options.ensembleFrom,
  } satisfies PermissionRequirement);

export const ADMIN_KEY = 'vmweb:admin-only';

/** Only the admin flag may do this (R-6), no role permission is enough. */
export const RequireAdmin = () => SetMetadata(ADMIN_KEY, true);

/** Request state set by `SessionGuard`. */
export interface RequestAuth {
  sessionId: string;
  session: SessionData;
  user: AccessUser;
  access: AccessContext;
}

export type AuthenticatedRequest = Request & { vmweb?: RequestAuth };

/** Parameter decorator for a part of the request's auth; only on non-public routes. */
const fromAuth = <T>(name: string, select: (auth: RequestAuth) => T) =>
  createParamDecorator((_: unknown, ctx: ExecutionContext): T => {
    const auth = ctx.switchToHttp().getRequest<AuthenticatedRequest>().vmweb;
    if (!auth) throw new Error(`${name} used on a route without session`);
    return select(auth);
  });

/** The caller's `AccessContext`; only on non-public routes (guaranteed by `SessionGuard`). */
export const CurrentAccess = fromAuth<AccessContext>('CurrentAccess', (auth) => auth.access);

/** The caller's account; only on non-public routes. */
export const CurrentUser = fromAuth<AccessUser>('CurrentUser', (auth) => auth.user);

