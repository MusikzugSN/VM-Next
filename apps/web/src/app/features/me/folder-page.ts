import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideFileArchive, lucidePrinter, lucideSearch, lucideX } from '@ng-icons/lucide';
import { APP_ROUTES, apiUrl, myFolderOverviewResponseSchema, myFolderScoresResponseSchema } from '@vm-web/shared';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputComponent } from '@/shared/components/input';

import { PrintLauncher } from '../../core/actions/pending-features';
import { ApiClient } from '../../core/api/api-client';
import { cursorList } from '../../core/api/cursor-list';
import { folderZipUrl } from '../../core/api/urls';
import { debounced } from '../../core/util/debounced';
import { VoiceContextStore } from '../../core/voices/voice-context.store';
import { ListState } from '../../shared/ui/list-state';
import { MemberScoreList } from './ui/member-score-list';
import { PageProblem } from '../../shared/ui/page-problem';
import { TagFilter, type TagFilterValue } from './ui/tag-filter';
import { usePageName } from '../../core/layout/page';
import { selectOr } from '../../core/util/resource-value';

/** Mappe (M-3, M-4, M-6, M-7): scores with number, search, tag filter, ZIP and print. */
@Component({
  selector: 'vm-me-folder-page',
  imports: [PluralPipe, 
    RouterLink,
    NgIcon,
    TranslocoPipe,
    ZardButtonComponent,
    ZardInputComponent,
    ListState,
    MemberScoreList,
    PageProblem,
    TagFilter,
  ],
  viewProviders: [provideIcons({ lucideChevronLeft, lucideFileArchive, lucidePrinter, lucideSearch, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="foldersPath" class="inline-flex min-h-11 items-center gap-1 self-start font-medium no-underline md:hidden">
      <ng-icon name="lucideChevronLeft" aria-hidden="true" />{{ 'nav.me.folders' | transloco }}
    </a>

    @if (overview.error()) {
      <vm-page-problem [error]="overview.error()" />
    } @else if (overview.hasValue()) {
      @let folder = overview.value();
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <h1 class="text-[22px] leading-7 font-semibold md:text-2xl md:leading-8">{{ folder.name }}</h1>
          <p class="mt-2 text-muted-foreground">
            {{ folder.ensemble.name }} · {{ 'me.common.scoreCount' | tPlural: folder.scoreCount }} ·
            {{ 'me.list.pages' | tPlural: folder.totalPages }}
          </p>
        </div>
        <div class="flex flex-col gap-2 md:flex-row-reverse">
          <a z-button [href]="zip()" download class="w-full md:w-auto">
            <ng-icon name="lucideFileArchive" aria-hidden="true" />{{ 'me.common.zip' | transloco }}
          </a>
          <button z-button zType="outline" type="button" class="w-full md:w-auto" (click)="print()">
            <ng-icon name="lucidePrinter" aria-hidden="true" />{{ 'common.print' | transloco }}
          </button>
        </div>
      </div>
      @if (folder.missingCount > 0) {
        <p class="text-destructive-ink">{{ 'me.common.missingHint' | tPlural: folder.missingCount }}</p>
      }
    }

    <div class="flex flex-col gap-2">
      <div class="flex items-end gap-2">
        <label class="flex flex-1 flex-col gap-1.5">
          <span class="font-medium">{{ 'me.folder.search' | transloco }}</span>
          <span class="relative">
            <ng-icon name="lucideSearch" class="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              z-input
              type="search"
              class="ps-9"
              [placeholder]="'me.folder.searchPlaceholder' | transloco"
              [value]="search()"
              (input)="search.set($any($event.target).value)"
            />
          </span>
        </label>
        <vm-tag-filter #filter [(value)]="tagFilter" />
      </div>
      @if (filter.activeName(); as name) {
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1 rounded-sm bg-primary-soft py-0.5 ps-2 text-primary">
            {{ name }}
            <button type="button" class="flex size-8 items-center justify-center" [attr.aria-label]="'me.filter.remove' | transloco: { name }" (click)="tagFilter.set(null)">
              <ng-icon name="lucideX" aria-hidden="true" />
            </button>
          </span>
        </div>
      }
    </div>

    <vm-member-score-list [rows]="list.items()" numbering="number" [folderId]="folderId()" [listTitle]="overview.hasValue() ? overview.value().name : ''" />
    <vm-list-state [list]="list" emptyKey="me.folder.empty" />
  `,
})
export class FolderPage {
  /** Breadcrumb and document title show the loaded element's name. */
  private readonly pageName = usePageName(() => selectOr(this.overview, (v) => v.name, null));
  private readonly api = inject(ApiClient);
  private readonly voices = inject(VoiceContextStore);
  private readonly printer = inject(PrintLauncher);

  /** Route parameter. */
  readonly folderId = input.required<string>();

  protected readonly foldersPath = APP_ROUTES.me.folders;
  protected readonly search = signal('');
  protected readonly tagFilter = signal<TagFilterValue>(null);
  private readonly query = debounced(this.search);

  protected readonly overview = rxResource({
    params: () => ({ folderId: this.folderId(), voiceId: this.voices.overrideIds() }),
    stream: ({ params }) =>
      this.api.get(apiUrl('me', 'folderOverview', { folderId: params.folderId }), myFolderOverviewResponseSchema, {
        voiceId: params.voiceId,
      }),
  });

  protected readonly list = cursorList({
    params: () => ({
      folderId: this.folderId(),
      voiceId: this.voices.overrideIds(),
      q: this.query().trim(),
      filter: this.tagFilter(),
    }),
    fetch: (p, cursor) =>
      this.api.get(apiUrl('me', 'folderScores', { folderId: p.folderId }), myFolderScoresResponseSchema, {
        cursor,
        voiceId: p.voiceId,
        q: p.q,
        clubTagId: p.filter?.kind === 'club' ? p.filter.id : undefined,
        personalTagId: p.filter?.kind === 'personal' ? p.filter.id : undefined,
      }),
  });

  protected readonly zip = computed(() => folderZipUrl(this.folderId(), this.voices.overrideIds()));

  protected print(): void {
    const name = selectOr(this.overview, (v) => v.name, '');
    this.printer.open({ scope: 'folder', id: this.folderId(), title: name });
  }
}
