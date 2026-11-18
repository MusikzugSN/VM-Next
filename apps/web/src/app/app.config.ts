import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { provideZard } from '@/shared/core/provider/providezard';

import { appRoutes } from './app.routes';
import { problemInterceptor } from './core/api/problem.interceptor';
import { provideI18n } from './core/i18n/i18n';
import { AppTitleStrategy } from './core/layout/page';

// Dates and numbers in German (DatePipe, DecimalPipe); only language for now.
registerLocaleData(localeDe);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'de-DE' },
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
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
