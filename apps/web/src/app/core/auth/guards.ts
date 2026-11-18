import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { APP_QUERY, APP_ROUTES, appPath, DEFAULT_APP_PATH, type Permission } from '@vm-web/shared';

import { isApiProblem } from '../api/api-problem';
import { SessionStore } from './session.store';

/** Only a path inside the app may be used as `returnTo` (no open redirect). */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}

function loginTree(router: Router, returnTo: string, error?: string): UrlTree {
  return router.parseUrl(appPath(APP_ROUTES.login, {}, { [APP_QUERY.returnTo]: returnTo, [APP_QUERY.error]: error }));
}

/** Area behind the login: without session → `/login?returnTo=<url>`. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  try {
    const result = await session.ensureLoaded();
    return result.authenticated ? true : loginTree(router, state.url);
  } catch (error) {
    // API not reachable: show the login page with the reason instead of a blank app.
    return loginTree(router, state.url, isApiProblem(error) ? error.code : 'unknown');
  }
};

/** Login page: already signed in → straight to `returnTo` or Mein Bereich. */
export const guestGuard: CanActivateFn = async (route) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  try {
    const result = await session.ensureLoaded();
    if (!result.authenticated) return true;
  } catch {
    return true;
  }
  return router.parseUrl(safeReturnTo(route.queryParamMap.get(APP_QUERY.returnTo)) ?? DEFAULT_APP_PATH);
};

/** Page needs one of the permissions (in at least one ensemble for ensemble-scoped ones) → else `/forbidden`. */
export function requirePermission(...permissions: Permission[]): CanActivateFn {
  return () => {
    const session = inject(SessionStore);
    return permissions.some((permission) => session.can(permission)) ? true : inject(Router).parseUrl(APP_ROUTES.forbidden);
  };
}

/** Mein Bereich and Drucken: member of at least one ensemble (R-2). */
export const memberGuard: CanActivateFn = () =>
  inject(SessionStore).isMember() ? true : inject(Router).parseUrl(APP_ROUTES.forbidden);
