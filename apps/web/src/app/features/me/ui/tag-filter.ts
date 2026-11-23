import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSlidersHorizontal, lucideX } from '@ng-icons/lucide';
import { apiUrl, myTagsResponseSchema } from '@vm-web/shared';

import { ZardDropdownImports } from '@/shared/components/dropdown/dropdown.imports';

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
  imports: [NgIcon, TranslocoPipe, ZardDropdownImports],
  viewProviders: [provideIcons({ lucideSlidersHorizontal, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <button
      type="button"
      z-dropdown
      [zDropdownMenu]="menu"
      [attr.aria-label]="'common.filter' | transloco"
      class="relative flex size-control shrink-0 items-center justify-center rounded-md border border-input bg-background shadow-sm hover:bg-accent xl:size-control-compact"
    >
      <ng-icon name="lucideSlidersHorizontal" aria-hidden="true" />
      @if (value()) {
        <span class="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">1</span>
        <span class="sr-only">{{ 'me.filter.active' | transloco }}</span>
      }
    </button>
    <z-dropdown-menu-content #menu="zDropdownMenuContent" zAlign="end" class="max-h-80 w-64 overflow-y-auto">
      <z-dropdown-menu-radio-group [zValue]="encoded()" (zValueChange)="select($event)">
        <z-dropdown-menu-radio-item zValue="">{{ 'me.filter.none' | transloco }}</z-dropdown-menu-radio-item>
        @if (tags.hasValue() && tags.value().clubTags.length) {
          <z-dropdown-menu-label>{{ 'me.tags.club' | transloco }}</z-dropdown-menu-label>
          @for (tag of tags.value().clubTags; track tag.id) {
            <z-dropdown-menu-radio-item [zValue]="'club:' + tag.id">{{ tag.name }}</z-dropdown-menu-radio-item>
          }
        }
        @if (tags.hasValue() && tags.value().personalTags.length) {
          <z-dropdown-menu-label>{{ 'me.tags.personal' | transloco }}</z-dropdown-menu-label>
          @for (tag of tags.value().personalTags; track tag.id) {
            <z-dropdown-menu-radio-item [zValue]="'personal:' + tag.id">{{ tag.name }}</z-dropdown-menu-radio-item>
          }
        }
      </z-dropdown-menu-radio-group>
    </z-dropdown-menu-content>
  `,
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
