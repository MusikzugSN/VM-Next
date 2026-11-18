import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideDownload, lucideUpload } from '@ng-icons/lucide';
import { APP_ROUTES, appPath, type MemberScoreRow, type MemberSheet } from '@vm-web/shared';

import { ZardButtonComponent } from '@/shared/components/button';

import { UploadLauncher } from '../../../core/actions/pending-features';
import { sheetPdfUrl } from '../../../core/api/urls';
import { SessionStore } from '../../../core/auth/session.store';
import { ViewportService } from '../../../core/layout/viewport';
import { StatusBadge } from '../../../shared/ui/status-badge';

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
 */
@Component({
  selector: 'vm-member-score-list',
  imports: [PluralPipe, RouterLink, NgIcon, TranslocoPipe, ZardButtonComponent, StatusBadge],
  viewProviders: [provideIcons({ lucideDownload, lucideUpload })],
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

  protected upload(row: ScoreListRow): void {
    this.uploads.open({ scoreId: row.scoreId, scoreTitle: row.title });
  }
}
