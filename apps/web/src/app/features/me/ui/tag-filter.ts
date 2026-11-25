import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSlidersHorizontal, lucideX } from '@ng-icons/lucide';
import { apiUrl, myTagsResponseSchema } from '@vm-web/shared';
import { VmBadgeCount, VmMenuImports } from '@vm-web/ui';


import { ApiClient } from '../../../core/api/api-client';

/** Selected tag filter (M-8): a club tag or an own personal tag. */
export type TagFilterValue = { kind: 'club' | 'personal'; id: string } | null;

/** Encodes the filter as one radio value: `club:<id>`, `personal:<id>` or ''. */
export function encodeTagFilter(value: TagFilterValue): string {
  return value ? `${value.kind}:${value.id}` : '';
}

export function decodeTagFilter(value: string | undefined): TagFilterValue {
  const match = /^(club|personal):(.+)$/.exec(value ?? '');
  return match ? { kind: match[1] as 'club' | 'personal', id: match[2] } : null;
}

/**
 * Filter button next to a search field (Design Guideline, Suchen & Filtern) with the tags of
 * Mein Bereich, plus the active filter as removable chip.
 */
@Component({
  selector: 'vm-tag-filter',
  imports: [VmBadgeCount, NgIcon, TranslocoPipe, VmMenuImports],
  viewProviders: [provideIcons({ lucideSlidersHorizontal, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './tag-filter.html',
})
export class TagFilter {
  private readonly api = inject(ApiClient);

  readonly value = model<TagFilterValue>(null);

  protected readonly tags = rxResource({ stream: () => this.api.get(apiUrl('me', 'tags'), myTagsResponseSchema) });
  protected readonly encoded = computed(() => encodeTagFilter(this.value()));
  /** Name of the active tag for the chip below the search. */
  readonly activeName = computed(() => {
    const value = this.value();
    if (!value || !this.tags.hasValue()) return null;
    const list = value.kind === 'club' ? this.tags.value().clubTags : this.tags.value().personalTags;
    return list.find((tag) => tag.id === value.id)?.name ?? null;
  });

  protected select(value: string | undefined): void {
    this.value.set(decodeTagFilter(value));
  }
}
