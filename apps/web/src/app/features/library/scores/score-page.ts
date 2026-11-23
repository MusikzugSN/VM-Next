import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideFolderOpen, lucidePrinter, lucideTrash2, lucideUpload } from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  appPath,
  scoreCompletenessResponseSchema,
  scoreDetailsResponseSchema,
  scoreFoldersResponseSchema,
  scoreSheetsResponseSchema,
  voiceOptionsResponseSchema,
  type ScoreCompletenessResponse,
} from '@vm-web/shared';

import { VmButton, VmIconButton, VmSelect } from '@vm-web/ui';
import { ZardDialogImports } from '@vm-web/ui/zard/components/dialog/dialog.imports';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { fieldProblemHandler } from '../../../core/actions/field-problem-handler';
import { focusFirstInvalid } from '../../../core/util/focus-invalid';
import { onUploadCompleted } from '../../../core/actions/on-upload';
import { UploadLauncher } from '../../../core/actions/pending-features';
import { ApiClient } from '../../../core/api/api-client';
import { withQuery } from '../../../core/api/urls';
import { SessionStore } from '../../../core/auth/session.store';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { PdfViewer } from '../../../shared/ui/pdf-viewer';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { PageProblem } from '../../../shared/ui/page-problem';
import { LibraryOptions } from '../library-options';
import { CompletenessBadge } from '../ui/completeness-badge';
import { ScoreForm } from './score-form';
import { buildScoreBody, scoreFormFromDetails, type ScoreFormErrors, type ScoreFormInput } from './score-form-model';
import { formatDuration } from './score-query';
import { TreeLabelPipe } from '../../../shared/ui/tree-label.pipe';
import { usePageName } from '../../../core/layout/page';
import { PrintLauncher } from '../../../core/actions/pending-features';
import { selectOr } from '../../../core/util/resource-value';

export type ScoreTab = 'details' | 'voices' | 'folders';

/** Lineup voices grouped by instrument in lineup order, with instrument names (N-6). */
export function groupCompleteness(
  completeness: ScoreCompletenessResponse,
  instruments: ReadonlyMap<string, string>,
): { instrumentId: string; name: string; present: number; voices: ScoreCompletenessResponse['voices'] }[] {
  const groups: { instrumentId: string; name: string; present: number; voices: ScoreCompletenessResponse['voices'] }[] = [];
  for (const entry of completeness.voices) {
    const id = entry.voice.instrumentId;
    let group = groups.find((g) => g.instrumentId === id);
    if (!group) {
      group = { instrumentId: id, name: instruments.get(id) ?? '', present: 0, voices: [] };
      groups.push(group);
    }
    group.voices.push(entry);
    if (entry.status === 'present') group.present++;
  }
  return groups;
}

/** Stück in der Notenverwaltung (N-1 bis N-5, N-9): tabs Stammdaten · Stimmen & Vollständigkeit · Mappen & Nummern. */
@Component({
  selector: 'vm-library-score-page',
  imports: [TreeLabelPipe, 
    RouterLink,
    NgIcon,
    TranslocoPipe,
    PluralPipe,
    VmButton, VmIconButton,
    ZardDialogImports,
    VmSelect,
    PdfViewer,
    StatusBadge,
    PageProblem,
    CompletenessBadge,
    ScoreForm,
  ],
  viewProviders: [provideIcons({ lucidePrinter, lucideUpload, lucideEye, lucideTrash2, lucideFolderOpen })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './score-page.html',
})
export class LibraryScorePage {
  private readonly printer = inject(PrintLauncher);
  /** Breadcrumb and document title show the loaded element's name. */
  private readonly pageName = usePageName(() => selectOr(this.details, (v) => v.title, null));
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly uploads = inject(UploadLauncher);
  protected readonly options = inject(LibraryOptions);

  /** Route parameter and query parameters. */
  readonly scoreId = input.required<string>();
  readonly tab = input<string>();
  readonly ensembleId = input<string>();

  protected readonly scorePath = computed(() => appPath(APP_ROUTES.library.score, { scoreId: this.scoreId() }));
  protected readonly reviewPath = APP_ROUTES.library.review;
  protected readonly current = computed<ScoreTab>(() => (this.tab() === 'voices' || this.tab() === 'folders' ? this.tab() as ScoreTab : 'details'));
  protected readonly tabs: { id: ScoreTab; labelKey: string }[] = [
    { id: 'details', labelKey: 'library.score.tabDetails' },
    { id: 'voices', labelKey: 'library.score.tabVoices' },
    { id: 'folders', labelKey: 'library.score.tabFolders' },
  ];
  protected readonly canEdit = computed(() => this.session.can('score.edit'));
  protected readonly canDelete = computed(() => this.session.can('score.delete'));
  protected readonly canUpload = computed(() => this.session.can('sheet.upload'));

  protected readonly details = rxResource({
    params: () => this.scoreId(),
    stream: ({ params }) => this.api.get(apiUrl('scores', 'scoreDetails', { scoreId: params }), scoreDetailsResponseSchema),
  });
  protected readonly folders = rxResource({
    params: () => this.scoreId(),
    stream: ({ params }) => this.api.get(apiUrl('scores', 'scoreFolders', { scoreId: params }), scoreFoldersResponseSchema),
  });
  protected readonly completeness = rxResource({
    params: () => (this.current() === 'voices' ? { scoreId: this.scoreId(), ensembleId: this.ensembleId() } : undefined),
    stream: ({ params }) =>
      this.api.get(apiUrl('scores', 'scoreCompleteness', { scoreId: params.scoreId }), scoreCompletenessResponseSchema, {
        ensembleId: params.ensembleId,
      }),
  });
  protected readonly sheets = rxResource({
    params: () => (this.current() === 'voices' ? this.scoreId() : undefined),
    stream: ({ params }) => this.api.get(apiUrl('scores', 'scoreSheets', { scoreId: params }), scoreSheetsResponseSchema),
  });
  private readonly voiceOptions = rxResource({
    params: () => (this.current() === 'voices' ? true : undefined),
    stream: () => this.api.get(apiUrl('me', 'voiceOptions'), voiceOptionsResponseSchema),
  });

  protected readonly groups = computed(() => {
    if (!this.completeness.hasValue()) return [];
    const names = new Map((selectOr(this.voiceOptions, (v) => v.groups, [])).map((g) => [g.instrument.id, g.instrument.name]));
    return groupCompleteness(this.completeness.value(), names);
  });
  /** Sheet id → page count for „2 Seiten“ in the voice list. */
  protected readonly sheetPages = computed(
    () => new Map((selectOr(this.sheets, (v) => v.items, [])).map((s) => [s.sheetId, s] as const)),
  );

  protected readonly form = signal<ScoreFormInput | null>(null);
  protected readonly errors = signal<ScoreFormErrors>({});
  private readonly focusInvalid = focusFirstInvalid();
  protected readonly saving = signal(false);
  protected readonly preview = signal<{ sheetId: string; title: string } | null>(null);
  protected readonly previewOpen = signal(false);

  constructor() {
    onUploadCompleted(() => {
      this.completeness.reload();
      this.sheets.reload();
    });
    // Fill the form once details and custom fields are there (again after saving).
    effect(() => {
      if (!this.details.hasValue() || !this.options.fieldsLoaded()) return;
      const details = this.details.value();
      const fields = this.options.fields();
      untracked(() => this.form.set(scoreFormFromDetails(details, fields)));
    });
  }

  protected subtitle(): string {
    if (!this.details.hasValue()) return '';
    const d = this.details.value();
    return [d.composer, d.publisher, formatDuration(d.durationSeconds)].filter(Boolean).join(' · ');
  }

  protected folderLink(id: string): string {
    return appPath(APP_ROUTES.library.folder, { folderId: id });
  }

  protected chooseEnsemble(ensembleId: string): void {
    void this.router.navigate([], { queryParams: { tab: 'voices', ensembleId: ensembleId || null }, queryParamsHandling: 'merge' });
  }

  protected upload(voiceId?: string): void {
    this.uploads.open({ scoreId: this.scoreId(), scoreTitle: selectOr(this.details, (v) => v.title, undefined), voiceId });
  }

  protected showSheet(sheetId: string, title: string): void {
    this.preview.set({ sheetId, title });
    this.previewOpen.set(true);
  }

  protected sheetUrl(sheetId: string): string {
    return withQuery(apiUrl('scores', 'sheetPdf', { sheetId }), { disposition: 'inline' });
  }

  protected async deleteSheet(sheetId: string, voiceName: string): Promise<void> {
    const done = await this.confirm.confirmedDelete('library.score.deleteSheetTitle', 'library.score.deleteSheetText', { voice: voiceName }, () => this.api.postVoid(apiUrl('scores', 'deleteSheet', { sheetId })), {
      success: { key: 'library.score.sheetDeleted', params: { voice: voiceName } },
    });
    if (done) {
      this.completeness.reload();
      this.sheets.reload();
    }
  }

  protected async save(): Promise<void> {
    const input = this.form();
    if (!input) return;
    const { body, errors } = buildScoreBody(input, this.options.fields());
    this.errors.set(errors);
    if (!body) {
      this.focusInvalid();
      return;
    }
    const done = await this.actions.runOnce(
      () => this.api.postVoid(apiUrl('scores', 'updateScoreDetails', { scoreId: this.scoreId() }), body),
      {
        busy: this.saving,
        success: { key: 'library.form.saved' },
        onProblem: fieldProblemHandler(this.errors, this.focusInvalid),
      },
    );
    if (done) this.details.reload();
  }

  protected async remove(): Promise<void> {
    const title = selectOr(this.details, (v) => v.title, '');
    const done = await this.confirm.confirmedDelete('library.scores.deleteTitle', 'library.scores.deleteText', { title }, () => this.api.postVoid(apiUrl('scores', 'deleteScore', { scoreId: this.scoreId() })), {
      success: { key: 'library.scores.deleted', params: { title } },
    });
    if (done) void this.router.navigateByUrl(APP_ROUTES.library.scores);
  }

  /** Druckdialog (D-1) for the whole score; the voices come from the voice switch. */
  protected print(): void {
    this.printer.open({ scope: 'score', id: this.scoreId(), title: selectOr(this.details, (v) => v.title, '') });
  }
}
