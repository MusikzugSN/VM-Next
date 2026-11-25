import type { Route } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { APP_ROUTES, childSegment, DEFAULT_APP_PATH } from '@vm-web/shared';

import { authGuard, guestGuard, memberGuard } from './core/auth/guards';
import { page } from './core/layout/page';

/** All paths from `APP_ROUTES` (`@vm-web/shared`); areas are lazy routes with their own translation scope. */
export const appRoutes: Route[] = [
  {
    path: childSegment(APP_ROUTES.login, '/'),
    canActivate: [guestGuard],
    providers: [provideTranslocoScope('auth')],
    ...page('pages.login'),
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: childSegment(APP_ROUTES.blocked, '/'),
    providers: [provideTranslocoScope('auth')],
    ...page('auth.blocked.title'),
    loadComponent: () => import('./features/auth/blocked-page').then((m) => m.BlockedPage),
  },
  // S-7: public, without session and without the app shell
  ...(['imprint', 'privacy'] as const).map((document) => ({
    path: childSegment(APP_ROUTES[document], '/'),
    ...page(`legal.${document}`),
    data: { ...page(`legal.${document}`).data, document },
    loadComponent: () => import('./features/legal/legal-page').then((m) => m.LegalPage),
  })),
  {
    path: '',
    loadComponent: () => import('./core/layout/app-shell').then((m) => m.AppShell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: childSegment(DEFAULT_APP_PATH, '/') },
      {
        path: childSegment(APP_ROUTES.me.root, '/'),
        canActivate: [memberGuard],
        loadChildren: () => import('./features/me/me.routes').then((m) => m.ME_ROUTES),
      },
      {
        path: childSegment(APP_ROUTES.library.root, '/'),
        loadChildren: () => import('./features/library/library.routes').then((m) => m.LIBRARY_ROUTES),
      },
      {
        path: childSegment(APP_ROUTES.print.root, '/'),
        canActivate: [memberGuard],
        loadChildren: () => import('./features/print/print.routes').then((m) => m.PRINT_ROUTES),
      },
      {
        path: childSegment(APP_ROUTES.system.root, '/'),
        loadChildren: () => import('./features/system/system.routes').then((m) => m.SYSTEM_ROUTES),
      },
      { path: childSegment(APP_ROUTES.forbidden, '/'), ...page('pages.forbidden.title'), loadComponent: () => import('./features/errors/error-pages').then((m) => m.ForbiddenPage) },
      { path: '**', ...page('pages.notFound.title'), loadComponent: () => import('./features/errors/error-pages').then((m) => m.NotFoundPage) },
    ],
  },
];
