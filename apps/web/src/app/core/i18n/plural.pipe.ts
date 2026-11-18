import { ChangeDetectorRef, inject, type OnDestroy, Pipe, type PipeTransform } from '@angular/core';
import { TRANSLOCO_LANG, TRANSLOCO_SCOPE, TranslocoPipe, TranslocoService } from '@jsverse/transloco';

/** Plural form of a count for German: `one` for exactly 1, otherwise `other`. */
export function pluralKey(key: string, count: number): string {
  return `${key}.${count === 1 ? 'one' : 'other'}`;
}

/**
 * `'me.list.pages' | tPlural: 3` → text of `me.list.pages.other` with `{{ count }}` = 3.
 * The translation file holds `{ "pages": { "one": "1 Seite", "other": "{{ count }} Seiten" } }`.
 * Wraps the Transloco pipe, so scopes and language changes work the same way.
 */
@Pipe({ name: 'tPlural', pure: false })
export class PluralPipe implements PipeTransform, OnDestroy {
  private readonly inner = new TranslocoPipe(
    inject(TranslocoService),
    inject(TRANSLOCO_SCOPE, { optional: true }) ?? undefined,
    inject(TRANSLOCO_LANG, { optional: true }) ?? undefined,
    inject(ChangeDetectorRef),
  );

  transform(key: string, count: number, params: Record<string, unknown> = {}): string {
    return this.inner.transform(pluralKey(key, count), { ...params, count });
  }

  ngOnDestroy(): void {
    this.inner.ngOnDestroy();
  }
}
