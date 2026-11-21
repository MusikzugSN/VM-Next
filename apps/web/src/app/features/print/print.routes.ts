import type { Routes } from '@angular/router';
import { APP_ROUTES, childSegment } from '@vm-web/shared';

import { page } from '../../core/layout/page';

const r = APP_ROUTES.print;
const meta = page('nav.print.history', { key: 'nav.print.section', path: r.root });

/** Drucken (Stufe 6): Druckverlauf; the print dialog itself lives in the app shell. Texts in global `print.*`. */
export const PRINT_ROUTES: Routes = [
  {
    path: childSegment(r.root, r.root),
    title: meta.title,
    data: meta.data,
    loadComponent: () => import('./print-history-page').then((m) => m.PrintHistoryPage),
  },
];
