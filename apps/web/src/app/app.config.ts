import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { provideZard } from '@/shared/core/provider/providezard';

import { appRoutes } from './app.routes';
import { problemInterceptor } from './core/api/problem.interceptor';
import { provideI18n } from './core/i18n/i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(
      withFetch(),
      // Same names as the API (BFF session, double-submit CSRF): cookie XSRF-TOKEN, header X-XSRF-TOKEN.
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
      withInterceptors([problemInterceptor]),
    ),
    provideZard(),
    ...provideI18n(),
  ],
};
