import type { Routes } from '@angular/router';
import { APP_ROUTES } from '@vm-web/shared';

import { comingSoon } from '../placeholder/coming-soon.routes';

const r = APP_ROUTES.me;
const section = { key: 'nav.me.section', path: r.root };

/** Mein Bereich (Stufe 2). */
export const ME_ROUTES: Routes = [
  comingSoon(r.root, r.root, 'nav.me.start', 2, section),
  comingSoon(r.folders, r.root, 'nav.me.folders', 2, section),
  comingSoon(r.folder, r.root, 'terms.folder', 2, section),
  comingSoon(r.events, r.root, 'nav.me.events', 2, section),
  comingSoon(r.event, r.root, 'terms.event', 2, section),
  comingSoon(r.tags, r.root, 'nav.me.tags', 2, section),
  comingSoon(r.clubTag, r.root, 'terms.tag', 2, section),
  comingSoon(r.personalTag, r.root, 'terms.tag', 2, section),
  comingSoon(r.score, r.root, 'terms.score', 2, section),
  comingSoon(r.uploads, r.root, 'nav.me.uploads', 2, section),
  comingSoon(r.profile, r.root, 'nav.me.profile', 2, section),
];
