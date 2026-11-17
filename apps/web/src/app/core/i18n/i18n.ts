import { HttpClient } from '@angular/common/http';
import { inject, Injectable, isDevMode, provideAppInitializer, type EnvironmentProviders } from '@angular/core';
import {
  provideTransloco,
  TranslocoService,
  type Translation,
  type TranslocoLoader,
} from '@jsverse/transloco';
import { firstValueFrom, type Observable } from 'rxjs';

import { de_DE, provideZardI18n } from '@/shared/core';

/** Only language for now; further languages get their own folder under `public/translate/`. */
export const DEFAULT_LANG = 'de-DE';
export const AVAILABLE_LANGS = [DEFAULT_LANG] as const;

/** Where the translation files are served (`apps/web/public/translate/<lang>/`). */
export const TRANSLATIONS_BASE = '/translate';

/**
 * Translation file of a Transloco path.
 *
 * - `de-DE` (global) → `/translate/de-DE/global.json`
 * - `me/de-DE` (scope `me`) → `/translate/de-DE/me.scope.json`
 */
export function translationFile(path: string): string {
  const slash = path.lastIndexOf('/');
  if (slash < 0) return `${TRANSLATIONS_BASE}/${path}/global.json`;
  return `${TRANSLATIONS_BASE}/${path.slice(slash + 1)}/${path.slice(0, slash)}.scope.json`;
}

@Injectable({ providedIn: 'root' })
export class TranslationFileLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(path: string): Observable<Translation> {
    return this.http.get<Translation>(translationFile(path));
  }
}

/**
 * Transloco with global texts (`global.json`, loaded before the first render) and one scope per
 * area (`<scope>.scope.json`, loaded with the lazy route via `provideTranslocoScope('<scope>')`).
 * Scoped keys are written with the scope as prefix: `me.start.title`.
 */
export function provideI18n(): EnvironmentProviders[] {
  return [
    ...provideTransloco({
      config: {
        availableLangs: [...AVAILABLE_LANGS],
        defaultLang: DEFAULT_LANG,
        fallbackLang: DEFAULT_LANG,
        reRenderOnLangChange: false,
        prodMode: !isDevMode(),
        missingHandler: { logMissingKey: isDevMode(), useFallbackTranslation: false },
      },
      loader: TranslationFileLoader,
    }),
    provideZardI18n(de_DE),
    provideAppInitializer(() => firstValueFrom(inject(TranslocoService).load(DEFAULT_LANG)).then(() => undefined)),
  ];
}
