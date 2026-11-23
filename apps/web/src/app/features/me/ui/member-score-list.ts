import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideDownload, lucideFileArchive, lucidePrinter, lucideUpload } from '@ng-icons/lucide';
import { APP_ROUTES, apiUrl, appPath, type MemberScoreRow, type MemberSheet } from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { VmButton, VmCard, VmCheckbox, VmIconButton, VmTable } from '@vm-web/ui';

import { PrintLauncher, UploadLauncher } from '../../../core/actions/pending-features';
import { ApiClient } from '../../../core/api/api-client';
import { ActionRunner } from '../../../core/actions/action-runner';
import { sheetPdfUrl } from '../../../core/api/urls';
import { SessionStore } from '../../../core/auth/session.store';
import { ViewportService } from '../../../core/layout/viewport';
import { saveBlob } from '../../../core/util/save-blob';
import { VoiceContextStore } from '../../../core/voices/voice-context.store';
import { SelectionBar } from '../../../shared/ui/selection-bar';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { safeFileName } from '../../../core/util/safe-file-name';
import { toggleSetItem } from '../../../core/util/sets';

export type ScoreListRow = MemberScoreRow & { position?: number };

/** Sheets shown for a row: own sheets, or the first substitute when no own one exists (M-3). */
export function shownSheets(row: MemberScoreRow): MemberSheet[] {
  const own = row.sheets.filter((sheet) => sheet.kind === 'own');
  return own.length ? own : row.sheets.slice(0, 1);
}

export function pageTotal(row: MemberScoreRow): number {
  return shownSheets(row).reduce((sum, sheet) => sum + sheet.pageCount, 0);
}

/** Folder numbers are shown with two digits („01“); other numbers („12a“) stay as they are. */
export function displayNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /^\d$/.test(text) ? `0${text}` : text;
}

/**
 * ScoreRow (Design Guideline) as a list: table from tablet width, cards on phones.
 * Title opens the score page; „Stimme fehlt“ always offers „Hochladen“ (M-9).
 * Rows can be selected for a ZIP or a print of the selection (M-6, M-7).
 */
@Component({
  selector: 'vm-member-score-list',
  imports: [VmTable, VmCheckbox, VmCard, PluralPipe, RouterLink, NgIcon, TranslocoPipe, VmButton, VmIconButton, StatusBadge, SelectionBar],
  viewProviders: [provideIcons({ lucideDownload, lucideUpload, lucideFileArchive, lucidePrinter })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './member-score-list.html',
})
export class MemberScoreList {
  private readonly session = inject(SessionStore);
  private readonly uploads = inject(UploadLauncher);
  protected readonly viewport = inject(ViewportService);

  readonly rows = input.required<readonly ScoreListRow[]>();
  /** First column: folder number, setlist position or none (tag lists). */
  readonly numbering = input<'number' | 'position' | 'none'>('number');
  readonly folderId = input<string | null>(null);
  readonly eventId = input<string | null>(null);
  /** Name of the list (folder, event, tag) for print history and file names. */
  readonly listTitle = input('');

  protected readonly canUpload = computed(() => this.session.can('sheet.upload'));
  protected readonly items = computed(() =>
    this.rows().map((row) => {
      const sheets = shownSheets(row);
      const first = sheets[0];
      return {
        row,
        number: this.numbering() === 'position' ? String(row.position ?? '') : displayNumber(row.number),
        pages: pageTotal(row),
        substitute: row.availability === 'substitute-only' && first ? first.voice.name : null,
        missing: row.availability === 'missing',
        link: appPath(APP_ROUTES.me.score, { scoreId: row.scoreId }),
        query: { folderId: this.folderId() ?? undefined, eventId: this.eventId() ?? undefined },
        download: first ? sheetPdfUrl(first.sheetId, { folderId: this.folderId() }) : null,
      };
    }),
  );

  private readonly api = inject(ApiClient);
  private readonly printer = inject(PrintLauncher);
  private readonly voices = inject(VoiceContextStore);
  private readonly actions = inject(ActionRunner);
  private readonly transloco = inject(TranslocoService);

  /** Selected score ids; rows without a sheet („Stimme fehlt“) cannot be selected. */
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly selectable = computed(() => this.items().filter((item) => !item.missing).map((item) => item.row.scoreId));
  protected readonly allSelected = computed(() => this.selectable().length > 0 && this.selectable().every((id) => this.selected().has(id)));
  protected readonly zipping = signal(false);

  protected toggle(scoreId: string): void {
    this.selected.update((current) => toggleSetItem(current, scoreId));
  }

  protected toggleAll(): void {
    this.selected.set(this.allSelected() ? new Set() : new Set(this.selectable()));
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  /** In list order, so the ZIP and the print follow the folder or setlist. */
  private selectedIds(): string[] {
    return this.items()
      .map((item) => item.row.scoreId)
      .filter((id) => this.selected().has(id));
  }

  protected async downloadZip(): Promise<void> {
    this.zipping.set(true);
    await this.actions.run(
      async () => {
        const zip = await firstValueFrom(
          this.api.postBlob(apiUrl('me', 'selectionZip'), {
            scoreIds: this.selectedIds(),
            folderId: this.folderId() ?? undefined,
            eventId: this.eventId() ?? undefined,
            voiceIds: [...this.voices.overrideIds()],
            substitutes: 'fallback',
          }),
        );
        const title = this.listTitle() || this.transloco.translate('common.selection.title');
        saveBlob(zip, `${safeFileName(title)}.zip`);
      },
      { fallbackKey: 'common.selection.zipFailed' },
    );
    this.zipping.set(false);
  }

  protected printSelection(): void {
    this.printer.open({
      scope: 'selection',
      id: '',
      title: this.listTitle() || this.transloco.translate('common.selection.title'),
      scoreIds: this.selectedIds(),
      folderId: this.folderId() ?? undefined,
      eventId: this.eventId() ?? undefined,
    });
  }

  protected upload(row: ScoreListRow): void {
    this.uploads.open({ scoreId: row.scoreId, scoreTitle: row.title });
  }
}
