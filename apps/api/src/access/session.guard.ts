import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CSRF_HEADER, SESSION_COOKIE } from '@vm-web/shared';
import type { Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ProblemException } from '../common/problem-details/problem.exception';
import { AccessContext } from './access-context';
import { AccessRepository } from './access.repository';
import { clearSessionCookies, readCookie } from './cookies';
import { PUBLIC_KEY, type AuthenticatedRequest, type PublicOptions } from './decorators';
import { SessionStore } from './session.store';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function tokensMatch(expected: string, actual: string | undefined): boolean {
  if (!actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * First global guard: resolves the session cookie, rejects blocked accounts (A-5),
 * requires a session on non-public routes and checks the CSRF token on state-changing requests.
 * Sets `req.vmweb` with session, user and `AccessContext`.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionStore) private readonly sessions: SessionStore,
    @Inject(AccessRepository) private readonly repo: AccessRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const publicOptions = this.reflector.getAllAndOverride<PublicOptions | undefined>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const sessionId = readCookie(req, SESSION_COOKIE);
    if (sessionId) {
      const session = await this.sessions.get(sessionId);
      const user = session ? await this.repo.loadUser(session.userId) : undefined;
      if (!session || !user) {
        if (session) await this.sessions.destroy(sessionId);
        clearSessionCookies(res);
      } else if (user.status === 'blocked') {
        await this.sessions.destroy(sessionId);
        clearSessionCookies(res);
        if (!publicOptions || publicOptions.reportBlocked) {
          throw new ProblemException(403, 'account-blocked');
        }
      } else {
        const access = new AccessContext(await this.repo.loadAccessInput(user));
        req.vmweb = { sessionId, session, user, access };
      }
    }

    if (publicOptions) return true;
    if (!req.vmweb) throw ProblemException.unauthenticated();
    if (!SAFE_METHODS.has(req.method)) {
      const header = req.headers[CSRF_HEADER.toLowerCase()];
      if (!tokensMatch(req.vmweb.session.csrfToken, Array.isArray(header) ? header[0] : header)) {
        throw new ProblemException(403, 'csrf-invalid');
      }
    }
    return true;
  }
}
