import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideFileArchive, lucidePrinter, lucideSearch, lucideX } from '@ng-icons/lucide';
import { APP_ROUTES, apiUrl, myFolderOverviewResponseSchema, myFolderScoresResponseSchema } from '@vm-web/shared';

import { VmButton, VmInput } from '@vm-web/ui';

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
    VmButton,
    VmInput,
    ListState,
    MemberScoreList,
    PageProblem,
    TagFilter,
  ],
  viewProviders: [provideIcons({ lucideChevronLeft, lucideFileArchive, lucidePrinter, lucideSearch, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './folder-page.html',
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
