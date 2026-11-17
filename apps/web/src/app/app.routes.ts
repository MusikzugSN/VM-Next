import { Route } from '@angular/router';

/**
 * Stufe 0: only the design preview. From Stufe 1 on the areas are added as lazy routes,
 * all paths from `APP_ROUTES` of `@vm-web/shared`.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/dev/design-preview').then((m) => m.DesignPreview),
  },
  { path: '**', redirectTo: '' },
];
