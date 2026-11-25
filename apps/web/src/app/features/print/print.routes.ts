import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { APP_ROUTES, childSegment } from '@vm-web/shared';

import { page } from '../../core/layout/page';

const r = APP_ROUTES.print;
const meta = page('nav.print.history', { key: 'nav.print.section', path: r.root });

/**
 * Drucken (Stufe 6): Druckverlauf. Its texts are in the `print` scope; the print dialog lives in the
 * app shell, so its texts (and the service guide it shares with this page) stay in global `print.*`.
 */
export const PRINT_ROUTES: Routes = [
  {
    path: childSegment(r.root, r.root),
    title: meta.title,
    data: meta.data,
    providers: [provideTranslocoScope('print')],
    loadComponent: () => import('./print-history-page').then((m) => m.PrintHistoryPage),
  },
];
