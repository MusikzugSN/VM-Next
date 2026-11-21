import type { CanActivateFn, Route, Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { APP_ROUTES, childSegment, type AppPath } from '@vm-web/shared';

import { requirePermission } from '../../core/auth/guards';
import { page, type Crumb } from '../../core/layout/page';
import { LibraryOptions } from './library-options';

const r = APP_ROUTES.library;
const section = { key: 'nav.library.section', path: r.scores };
/** List page of each detail page, for the breadcrumbs. */
const parents: Partial<Record<AppPath, Crumb>> = {
  [r.newScore]: { key: 'nav.library.scores', path: r.scores },
  [r.importScores]: { key: 'nav.library.scores', path: r.scores },
  [r.score]: { key: 'nav.library.scores', path: r.scores },
  [r.reviewUpload]: { key: 'nav.library.review', path: r.review },
  [r.folder]: { key: 'nav.library.folders', path: r.folders },
  [r.event]: { key: 'nav.library.events', path: r.events },
};

function libraryPage(path: AppPath, titleKey: string, guard: CanActivateFn, loadComponent: Route['loadComponent']): Route {
  const meta = page(titleKey, section, parents[path]);
  return { path: childSegment(path, r.root), canActivate: [guard], title: meta.title, data: meta.data, loadComponent };
}

/** Notenverwaltung (Stufe 3) und Prüfung (Stufe 4); texts in the `library` scope. */
export const LIBRARY_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('library'), LibraryOptions],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'scores' },
      libraryPage(r.scores, 'nav.library.scores', requirePermission('score.view'), () =>
        import('./scores/scores-page').then((m) => m.ScoresPage),
      ),
      libraryPage(r.newScore, 'pages.newScore', requirePermission('score.create'), () =>
        import('./scores/new-score-page').then((m) => m.NewScorePage),
      ),
      libraryPage(r.importScores, 'pages.importScores', requirePermission('score.create'), () =>
        import('./scores/import/score-import-page').then((m) => m.ScoreImportPage),
      ),
      libraryPage(r.score, 'terms.score', requirePermission('score.view'), () =>
        import('./scores/score-page').then((m) => m.LibraryScorePage),
      ),
      libraryPage(r.voices, 'nav.library.voices', requirePermission('voice.view'), () =>
        import('./voices/voices-page').then((m) => m.VoicesPage),
      ),
      libraryPage(r.tags, 'nav.library.tags', requirePermission('tag.view'), () =>
        import('./tags/club-tags-page').then((m) => m.ClubTagsPage),
      ),
      libraryPage(r.review, 'nav.library.review', requirePermission('sheet.approve'), () =>
        import('./review/review-page').then((m) => m.ReviewPage),
      ),
      libraryPage(r.reviewUpload, 'nav.library.review', requirePermission('sheet.approve'), () =>
        import('./review/review-page').then((m) => m.ReviewPage),
      ),
      libraryPage(r.folders, 'nav.library.folders', requirePermission('folder.view'), () =>
        import('./folders/manage-folders-page').then((m) => m.ManageFoldersPage),
      ),
      libraryPage(r.folder, 'pages.editFolder', requirePermission('folder.view'), () =>
        import('./folders/edit-folder-page').then((m) => m.EditFolderPage),
      ),
      libraryPage(r.events, 'nav.library.events', requirePermission('event.view'), () =>
        import('./events/manage-events-page').then((m) => m.ManageEventsPage),
      ),
      libraryPage(r.event, 'pages.editEvent', requirePermission('event.view'), () =>
        import('./events/edit-event-page').then((m) => m.EditEventPage),
      ),
    ],
  },
];
