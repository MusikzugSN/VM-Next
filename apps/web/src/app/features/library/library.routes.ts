import type { CanActivateFn, Route, Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { APP_ROUTES, childSegment, type AppPath } from '@vm-web/shared';

import { requirePermission } from '../../core/auth/guards';
import { page } from '../../core/layout/page';
import { comingSoon } from '../placeholder/coming-soon.routes';
import { LibraryOptions } from './library-options';

const r = APP_ROUTES.library;
const section = { key: 'nav.library.section', path: r.scores };

function libraryPage(path: AppPath, titleKey: string, guard: CanActivateFn, loadComponent: Route['loadComponent']): Route {
  const meta = page(titleKey, section);
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
      libraryPage(r.score, 'terms.score', requirePermission('score.view'), () =>
        import('./scores/score-page').then((m) => m.LibraryScorePage),
      ),
      libraryPage(r.voices, 'nav.library.voices', requirePermission('voice.view'), () =>
        import('./voices/voices-page').then((m) => m.VoicesPage),
      ),
      libraryPage(r.tags, 'nav.library.tags', requirePermission('tag.view'), () =>
        import('./tags/club-tags-page').then((m) => m.ClubTagsPage),
      ),
      comingSoon(r.review, r.root, 'nav.library.review', 4, section, [requirePermission('sheet.approve')]),
      comingSoon(r.reviewUpload, r.root, 'nav.library.review', 4, section, [requirePermission('sheet.approve')]),
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
