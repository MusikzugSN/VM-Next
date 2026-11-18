import type { Routes } from '@angular/router';
import { APP_ROUTES } from '@vm-web/shared';

import { requirePermission } from '../../core/auth/guards';
import { comingSoon } from '../placeholder/coming-soon.routes';

const r = APP_ROUTES.system;
const section = { key: 'nav.system.section', path: r.users };

/** Systemverwaltung (Stufe 5). */
export const SYSTEM_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  comingSoon(r.users, r.root, 'nav.system.users', 5, section, [requirePermission('user.view')]),
  comingSoon(r.user, r.root, 'pages.user', 5, section, [requirePermission('user.view')]),
  comingSoon(r.ensembles, r.root, 'nav.system.ensembles', 5, section, [requirePermission('ensemble.view')]),
  comingSoon(r.ensemble, r.root, 'terms.ensemble', 5, section, [requirePermission('ensemble.view')]),
  comingSoon(r.roles, r.root, 'nav.system.roles', 5, section, [requirePermission('role.view')]),
  comingSoon(r.role, r.root, 'terms.role', 5, section, [requirePermission('role.view')]),
  // Tab „Eigene Felder“ is also for librarians (score.edit).
  comingSoon(r.settings, r.root, 'nav.system.settings', 5, section, [requirePermission('config.view', 'score.edit')]),
];
