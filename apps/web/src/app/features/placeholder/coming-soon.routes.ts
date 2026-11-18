import type { CanActivateFn, Route } from '@angular/router';
import { childSegment, type AppPath } from '@vm-web/shared';

import { page } from '../../core/layout/page';

export interface Section {
  key: string;
  path: string;
}

/**
 * Route of a page that is built in a later stage: correct path, title, breadcrumb and guard,
 * content is the placeholder. Each stage replaces its entries with the real page.
 */
export function comingSoon(
  path: AppPath,
  parent: AppPath,
  titleKey: string,
  stage: number,
  section: Section,
  canActivate: CanActivateFn[] = [],
): Route {
  const meta = page(titleKey, section);
  return {
    path: childSegment(path, parent),
    canActivate,
    title: meta.title,
    data: { ...meta.data, stage },
    loadComponent: () => import('./coming-soon-page').then((m) => m.ComingSoonPage),
  };
}
