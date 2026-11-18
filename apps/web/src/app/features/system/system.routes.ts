import type { CanActivateFn, Route, Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { APP_ROUTES, childSegment, type AppPath } from '@vm-web/shared';

import { requirePermission } from '../../core/auth/guards';
import { page, type Crumb } from '../../core/layout/page';

const r = APP_ROUTES.system;
const section = { key: 'nav.system.section', path: r.users };
/** List page of each detail page, for the breadcrumbs. */
const parents: Partial<Record<AppPath, Crumb>> = {
  [r.user]: { key: 'nav.system.users', path: r.users },
  [r.ensemble]: { key: 'nav.system.ensembles', path: r.ensembles },
  [r.role]: { key: 'nav.system.roles', path: r.roles },
};

function systemPage(path: AppPath, titleKey: string, guard: CanActivateFn, loadComponent: Route['loadComponent']): Route {
  const meta = page(titleKey, section, parents[path]);
  return { path: childSegment(path, r.root), canActivate: [guard], title: meta.title, data: meta.data, loadComponent };
}

/** Systemverwaltung (Stufe 5); texts in the `system` scope. */
export const SYSTEM_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('system')],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      systemPage(r.users, 'nav.system.users', requirePermission('user.view'), () => import('./users/users-page').then((m) => m.UsersPage)),
      systemPage(r.user, 'pages.user', requirePermission('user.view'), () => import('./users/user-page').then((m) => m.UserPage)),
      systemPage(r.ensembles, 'nav.system.ensembles', requirePermission('ensemble.view'), () =>
        import('./ensembles/ensembles-page').then((m) => m.EnsemblesPage),
      ),
      systemPage(r.ensemble, 'terms.ensemble', requirePermission('ensemble.view'), () => import('./ensembles/ensemble-page').then((m) => m.EnsemblePage)),
      systemPage(r.roles, 'nav.system.roles', requirePermission('role.view'), () => import('./roles/roles-page').then((m) => m.RolesPage)),
      systemPage(r.role, 'terms.role', requirePermission('role.view'), () => import('./roles/role-page').then((m) => m.RolePage)),
      // Tab „Eigene Felder“ is also for librarians (score.edit).
      systemPage(r.settings, 'nav.system.settings', requirePermission('config.view', 'score.edit', 'config.edit'), () =>
        import('./settings/settings-page').then((m) => m.SettingsPage),
      ),
    ],
  },
];
