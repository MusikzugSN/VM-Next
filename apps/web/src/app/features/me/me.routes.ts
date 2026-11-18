import type { Route, Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { APP_ROUTES, childSegment, type AppPath } from '@vm-web/shared';

import { page, type Crumb } from '../../core/layout/page';

const r = APP_ROUTES.me;
const section = { key: 'nav.me.section', path: r.root };
/** List page of each detail page, for the breadcrumbs. */
const parents: Partial<Record<AppPath, Crumb>> = {
  [r.folder]: { key: 'nav.me.folders', path: r.folders },
  [r.event]: { key: 'nav.me.events', path: r.events },
  [r.clubTag]: { key: 'nav.me.tags', path: r.tags },
  [r.personalTag]: { key: 'nav.me.tags', path: r.tags },
};

function mePage(path: AppPath, titleKey: string, loadComponent: Route['loadComponent'], data: Record<string, unknown> = {}): Route {
  const meta = page(titleKey, section, parents[path]);
  return { path: childSegment(path, r.root), title: meta.title, data: { ...meta.data, ...data }, loadComponent };
}

/** Mein Bereich (Stufe 2); texts in the `me` scope. */
export const ME_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('me')],
    children: [
      mePage(r.root, 'nav.me.start', () => import('./start-page').then((m) => m.StartPage)),
      mePage(r.folders, 'nav.me.folders', () => import('./folders-page').then((m) => m.FoldersPage)),
      mePage(r.folder, 'terms.folder', () => import('./folder-page').then((m) => m.FolderPage)),
      mePage(r.events, 'nav.me.events', () => import('./events-page').then((m) => m.EventsPage)),
      mePage(r.event, 'terms.event', () => import('./event-page').then((m) => m.EventPage)),
      mePage(r.tags, 'nav.me.tags', () => import('./tags-page').then((m) => m.TagsPage)),
      mePage(r.clubTag, 'nav.me.tags', () => import('./tags-page').then((m) => m.TagsPage), { kind: 'club' }),
      mePage(r.personalTag, 'nav.me.tags', () => import('./tags-page').then((m) => m.TagsPage), { kind: 'personal' }),
      mePage(r.score, 'terms.score', () => import('./score-page').then((m) => m.ScorePage)),
      mePage(r.uploads, 'nav.me.uploads', () => import('./uploads-page').then((m) => m.UploadsPage)),
      mePage(r.profile, 'nav.me.profile', () => import('./profile-page').then((m) => m.ProfilePage)),
    ],
  },
];
