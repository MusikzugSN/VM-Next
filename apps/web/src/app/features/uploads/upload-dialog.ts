import { HttpClient, HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideFileText, lucideInfo, lucideScissors, lucideUpload, lucideX } from '@ng-icons/lucide';
import {
  apiUrl,
  UPLOAD_FILE_FIELD,
  UPLOAD_MAX_FILES,
  UPLOAD_META_FIELD,
  uploadSheetsResponseSchema,
  type UploadSheetsResponse,
  voiceSuggestionsResponseSchema,
} from '@vm-web/shared';
import { filter, firstValueFrom, last, map, tap } from 'rxjs';

import { VmButton, VmIconButton } from '@vm-web/ui';
import { ZardDialogImports } from '@vm-web/ui/zard/components/dialog/dialog.imports';
import { ZardSonnerService } from '@vm-web/ui/zard/components/sonner';

import { UploadLauncher } from '../../core/actions/pending-features';
import { ApiClient } from '../../core/api/api-client';
import { isApiProblem } from '../../core/api/api-problem';
import { SessionStore } from '../../core/auth/session.store';
import { PluralPipe, pluralKey } from '../../core/i18n/plural.pipe';
import { ReviewCountStore } from '../../core/review/review-count.store';
import { ScoreSearchSelect, type ChosenScore } from '../../shared/ui/score-search-select';
import { VoiceSelect } from '../../shared/ui/voice-select';
import { UploadSplit, type SplitPart } from './upload-split';
import { addFiles, batches, formatSize, replaceWithParts, sendable, uploadMeta, type UploadItem } from './upload-model';

/**
 * Noten hochladen (N-10, N-11, M-9): several PDFs at once, voice proposed from the file name,
 * score and voice per file, summary before sending, progress while sending.
 */
@Component({
  selector: 'vm-upload-dialog',
  imports: [NgIcon, TranslocoPipe, PluralPipe, VmButton, VmIconButton, ZardDialogImports, ScoreSearchSelect, VoiceSelect, UploadSplit],
  viewProviders: [provideIcons({ lucideUpload, lucideFileText, lucideX, lucideInfo, lucideCircleAlert, lucideScissors })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog renders in an overlay; its host must not take up space (or a gap) in the page.
  host: { style: 'display: contents' },
  templateUrl: './upload-dialog.html',
})
export class UploadDialog {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiClient);
  private readonly launcher = inject(UploadLauncher);
  private readonly session = inject(SessionStore);
  private readonly review = inject(ReviewCountStore);
  private readonly sonner = inject(ZardSonnerService);
  private readonly transloco = inject(TranslocoService);

  protected readonly maxFiles = UPLOAD_MAX_FILES;
  protected readonly open = signal(false);
  protected readonly items = signal<UploadItem[]>([]);
  protected readonly dragging = signal(false);
  protected readonly sending = signal(false);
  /** 0–100 while sending. */
  protected readonly progress = signal(0);
  protected readonly canApprove = computed(() => this.session.can('sheet.approve'));
  /** File shown in the split viewer (N-18); `null` = file list. */
  protected readonly splitKey = signal<string | null>(null);
  protected readonly splitItem = computed(() => this.items().find((item) => item.key === this.splitKey()) ?? null);
  protected readonly splitPreset = computed(() => this.launcher.request() ?? {});

  protected readonly valid = computed(() => sendable(this.items()));
  protected readonly invalidCount = computed(() => this.items().length - this.valid().length);
  protected readonly unassigned = computed(() => this.valid().filter((item) => !item.scoreId || !item.voiceId).length);

  constructor() {
    // The launcher opens the dialog; closing it (Esc, X, Abbrechen) resets the launcher.
    effect(() => {
      const request = this.launcher.request();
      untracked(() => {
        if (request && !this.open()) {
          this.items.set([]);
          this.splitKey.set(null);
          this.progress.set(0);
          this.open.set(true);
        }
      });
    });
    effect(() => {
      if (!this.open()) untracked(() => this.launcher.close());
    });
  }

  protected size(item: UploadItem): string {
    return formatSize(item.file.size);
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.add(Array.from(input.files ?? []));
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    void this.add(Array.from(event.dataTransfer?.files ?? []));
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected remove(key: string): void {
    this.items.update((items) => items.filter((item) => item.key !== key));
  }

  protected setScore(key: string, score: ChosenScore | null): void {
    this.patch(key, { scoreId: score?.id ?? null, scoreTitle: score?.title ?? null });
  }

  protected setVoice(key: string, voiceId: string | null): void {
    this.patch(key, { voiceId, suggested: false });
  }

  protected onSplit(parts: SplitPart[]): void {
    const key = this.splitKey();
    if (key) this.items.update((items) => replaceWithParts(items, key, parts));
    this.splitKey.set(null);
  }

  protected chosenScore(item: UploadItem): ChosenScore | null {
    return item.scoreId && item.scoreTitle ? { id: item.scoreId, title: item.scoreTitle } : null;
  }

  protected async send(): Promise<void> {
    const items = this.valid();
    if (!items.length) return;
    this.sending.set(true);
    this.progress.set(0);
    const sent = new Set<string>();
    try {
      // More than 50 files (e.g. after splitting, N-18) go in several requests.
      const total = items.reduce((sum, item) => sum + item.file.size, 0) || 1;
      let done = 0;
      const results: UploadSheetsResponse['items'] = [];
      for (const batch of batches(items)) {
        const response = await this.sendBatch(batch, (loaded) => this.progress.set(Math.round(((done + loaded) / total) * 100)));
        results.push(...response.items);
        batch.forEach((item) => sent.add(item.key));
        done += batch.reduce((sum, item) => sum + item.file.size, 0);
      }
      const approved = results.filter((item) => item.status === 'approved').length;
      const key = approved === results.length ? 'upload.doneApproved' : approved > 0 ? 'upload.donePartly' : 'upload.done';
      this.sonner.success(this.transloco.translate(pluralKey(key, results.length), { count: results.length, approved }));
      this.review.refresh();
      this.launcher.notifyCompleted();
      this.open.set(false);
    } catch (error) {
      // Batches already sent are not sent twice when trying again.
      if (sent.size) {
        this.items.update((list) => list.filter((item) => !sent.has(item.key)));
        this.review.refresh();
        this.launcher.notifyCompleted();
      }
      this.sonner.error(this.transloco.translate(isApiProblem(error) ? error.messageKey : 'errors.unknown'));
    } finally {
      this.sending.set(false);
    }
  }

  private sendBatch(items: readonly UploadItem[], progress: (loaded: number) => void): Promise<UploadSheetsResponse> {
    const form = new FormData();
    for (const item of items) form.append(UPLOAD_FILE_FIELD, item.file, item.file.name);
    form.append(UPLOAD_META_FIELD, JSON.stringify(uploadMeta(items)));
    return firstValueFrom(
      this.http.post(apiUrl('uploads', 'uploadSheets'), form, { reportProgress: true, observe: 'events' }).pipe(
        tap((event) => {
          if (event.type === HttpEventType.UploadProgress) progress(event.loaded);
        }),
        filter((event) => event.type === HttpEventType.Response),
        last(),
        map((event) => uploadSheetsResponseSchema.parse(event.body)),
      ),
    );
  }

  /** Adds files and asks the API for a voice per file name (N-11). */
  private async add(files: File[]): Promise<void> {
    const preset = this.launcher.request() ?? {};
    const before = new Set(this.items().map((item) => item.key));
    this.items.set(addFiles(this.items(), files, preset));
    const added = this.items().filter((item) => !before.has(item.key) && !item.problem && !item.voiceId);
    if (!added.length) return;
    try {
      const result = await firstValueFrom(
        this.api.get(apiUrl('uploads', 'voiceSuggestions'), voiceSuggestionsResponseSchema, { fileName: added.map((i) => i.file.name) }),
      );
      for (const suggestion of result.items) {
        const item = added.find((i) => i.file.name === suggestion.fileName);
        if (item && suggestion.voice) this.patch(item.key, { voiceId: suggestion.voice.id, suggested: true }, true);
      }
    } catch {
      // Without suggestions the voices are chosen by hand.
    }
  }

  private patch(key: string, patch: Partial<UploadItem>, onlyIfEmpty = false): void {
    this.items.update((items) =>
      items.map((item) => (item.key === key && (!onlyIfEmpty || !item.voiceId) ? { ...item, ...patch } : item)),
    );
  }
}
