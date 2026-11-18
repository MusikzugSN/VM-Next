import type { Routes } from '@angular/router';
import { APP_ROUTES } from '@vm-web/shared';

import { requirePermission } from '../../core/auth/guards';
import { comingSoon } from '../placeholder/coming-soon.routes';

const r = APP_ROUTES.library;
const section = { key: 'nav.library.section', path: r.scores };

/** Notenverwaltung (Stufe 3) und Prüfung (Stufe 4). */
export const LIBRARY_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'scores' },
  comingSoon(r.scores, r.root, 'nav.library.scores', 3, section, [requirePermission('score.view')]),
  comingSoon(r.newScore, r.root, 'pages.newScore', 3, section, [requirePermission('score.create')]),
  comingSoon(r.score, r.root, 'terms.score', 3, section, [requirePermission('score.view')]),
  comingSoon(r.review, r.root, 'nav.library.review', 4, section, [requirePermission('sheet.approve')]),
  comingSoon(r.reviewUpload, r.root, 'nav.library.review', 4, section, [requirePermission('sheet.approve')]),
  comingSoon(r.folders, r.root, 'nav.library.folders', 3, section, [requirePermission('folder.view')]),
  comingSoon(r.folder, r.root, 'pages.editFolder', 3, section, [requirePermission('folder.view')]),
  comingSoon(r.events, r.root, 'nav.library.events', 3, section, [requirePermission('event.view')]),
  comingSoon(r.event, r.root, 'pages.editEvent', 3, section, [requirePermission('event.view')]),
  comingSoon(r.tags, r.root, 'nav.library.tags', 3, section, [requirePermission('tag.view')]),
  comingSoon(r.voices, r.root, 'nav.library.voices', 3, section, [requirePermission('voice.view')]),
];
