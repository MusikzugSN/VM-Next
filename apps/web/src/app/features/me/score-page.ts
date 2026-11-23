import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideDownload, lucidePlus, lucidePrinter, lucideUpload, lucideX } from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  appPath,
  createdResponseSchema,
  myScoreOverviewResponseSchema,
  myTagsResponseSchema,
  type MemberSheet,
} from '@vm-web/shared';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardDropdownImports } from '@/shared/components/dropdown/dropdown.imports';
import { ZardSheetImports } from '@/shared/components/sheet/sheet.imports';

import { PrintLauncher, UploadLauncher } from '../../core/actions/pending-features';
import { ApiClient } from '../../core/api/api-client';
import { ActionRunner } from '../../core/actions/action-runner';
import { sheetPdfUrl } from '../../core/api/urls';
import { SessionStore } from '../../core/auth/session.store';
import { ViewportService } from '../../core/layout/viewport';
import { VoiceContextStore } from '../../core/voices/voice-context.store';
import { PdfViewer } from '../../shared/ui/pdf-viewer';
import { StatusBadge } from '../../shared/ui/status-badge';
import { PageProblem } from '../../shared/ui/page-problem';
import { NameDialog } from '../../shared/ui/name-dialog';
import { usePageName } from '../../core/layout/page';
import { valueOr } from '../../core/util/resource-value';

/** Stück in Mein Bereich (M-3, M-6, M-8, M-9): PDF preview of the own voice, download, print, personal tags. */
@Component({
  selector: 'vm-me-score-page',
  imports: [PluralPipe, 
    NgTemplateOutlet,
    RouterLink,
    NgIcon,
    TranslocoPipe,
    ZardButtonComponent,
    ZardDropdownImports,
    ZardSheetImports,
    PdfViewer,
    StatusBadge,
    PageProblem,
    NameDialog,
  ],
  viewProviders: [provideIcons({ lucideChevronLeft, lucideDownload, lucidePrinter, lucideUpload, lucidePlus, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './score-page.html',
})
export class ScorePage {
  /** Breadcrumb and document title show the loaded element's name. */
  private readonly pageName = usePageName(() => this.score()?.title);
  private readonly api = inject(ApiClient);
  private readonly voices = inject(VoiceContextStore);
  private readonly session = inject(SessionStore);
  private readonly uploads = inject(UploadLauncher);
  private readonly printer = inject(PrintLauncher);
  private readonly actions = inject(ActionRunner);
  protected readonly viewport = inject(ViewportService);

  /** Route parameter and optional context from the list the score was opened from. */
  readonly scoreId = input.required<string>();
  readonly folderId = input<string>();
  readonly eventId = input<string>();

  protected readonly detailsOpen = signal(false);
  protected readonly creatingTag = signal(false);
  protected readonly canUpload = computed(() => this.session.can('sheet.upload'));

  protected readonly overview = rxResource({
    params: () => ({ scoreId: this.scoreId(), voiceId: this.voices.overrideIds() }),
    stream: ({ params }) =>
      this.api.get(apiUrl('me', 'scoreOverview', { scoreId: params.scoreId }), myScoreOverviewResponseSchema, {
        voiceId: params.voiceId,
      }),
  });
  protected readonly myTags = rxResource({ stream: () => this.api.get(apiUrl('me', 'tags'), myTagsResponseSchema) });

  protected readonly score = computed(() => valueOr(this.overview, null));
  /** The sheet in the preview; the first one (own voice first) unless another is chosen. */
  protected readonly sheet = linkedSignal<MemberSheet | null>(() => this.score()?.sheets[0] ?? null);
  protected readonly previewUrl = computed(() => {
    const sheet = this.sheet();
    return sheet ? sheetPdfUrl(sheet.sheetId, { folderId: this.folderId(), inline: true }) : null;
  });
  protected readonly downloadUrl = computed(() => {
    const sheet = this.sheet();
    return sheet ? sheetPdfUrl(sheet.sheetId, { folderId: this.folderId() }) : null;
  });
  protected readonly back = computed(() => {
    const folderId = this.folderId();
    const eventId = this.eventId();
    if (folderId) return { path: appPath(APP_ROUTES.me.folder, { folderId }), labelKey: 'terms.folder' };
    if (eventId) return { path: appPath(APP_ROUTES.me.event, { eventId }), labelKey: 'terms.event' };
    return { path: APP_ROUTES.me.root, labelKey: 'nav.me.start' };
  });
  /** Own personal tags not yet on this score, for „Tag hinzufügen“. */
  protected readonly addableTags = computed(() => {
    const score = this.score();
    if (!score || !this.myTags.hasValue()) return [];
    const assigned = new Set(score.personalTags.map((tag) => tag.id));
    return this.myTags.value().personalTags.filter((tag) => !assigned.has(tag.id));
  });

  protected print(): void {
    const sheet = this.sheet();
    // A substitute sheet is printed for the voice it stands in for, with substitutes allowed.
    if (sheet) this.printer.open({ scope: 'score', id: this.scoreId(), title: this.score()?.title ?? '', voiceIds: [sheet.substituteFor?.id ?? sheet.voice.id] });
  }

  protected upload(voiceId?: string): void {
    this.uploads.open({ scoreId: this.scoreId(), scoreTitle: this.score()?.title, voiceId });
  }

  protected async addTag(tagId: string): Promise<void> {
    await this.actions.runOnce(() => this.api.postVoid(apiUrl('me', 'addPersonalTag', { scoreId: this.scoreId() }), { tagId }));
    this.overview.reload();
  }

  protected async removeTag(tagId: string): Promise<void> {
    await this.actions.runOnce(() =>
      this.api.postVoid(apiUrl('me', 'removePersonalTag', { scoreId: this.scoreId() }), { tagId }),
    );
    this.overview.reload();
  }

  /** New personal tag from the tag menu; it is added to this score right away. */
  protected readonly createTag = async (name: string): Promise<boolean> => {
    const created = await this.actions.runOnce(() =>
      this.api.post(apiUrl('me', 'createPersonalTag'), { name }, createdResponseSchema),
    );
    if (!created) return false;
    this.myTags.reload();
    await this.addTag(created.value.id);
    return true;
  };
}
