import type { Routes } from '@angular/router';
import { APP_ROUTES } from '@vm-web/shared';

import { comingSoon } from '../placeholder/coming-soon.routes';

const r = APP_ROUTES.print;
const section = { key: 'nav.print.section', path: r.root };

/** Drucken (Stufe 6). */
export const PRINT_ROUTES: Routes = [comingSoon(r.root, r.root, 'nav.print.history', 6, section)];
