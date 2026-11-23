import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideCrop,
  lucidePanelLeftClose,
  lucidePanelLeftOpen,
  lucideRotateCw,
  lucideZoomIn,
  lucideZoomOut,
} from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  appPath,
  approveUploadResponseSchema,
  rejectUploadResponseSchema,
  reviewQueueResponseSchema,
  uploadDetailsResponseSchema,
  type ReviewQueueItem,
} from '@vm-web/shared';
import { tap } from 'rxjs';

import { VmButton, VmCheckbox, VmField, VmFieldError, VmFieldLabel, VmIconButton, VmTextarea } from '@vm-web/ui';

import { ActionRunner } from '../../../core/actions/action-runner';
import { onUploadCompleted } from '../../../core/actions/on-upload';
import { ApiClient } from '../../../core/api/api-client';
import { isApiProblem } from '../../../core/api/api-problem';
import { cursorList } from '../../../core/api/cursor-list';
import { SessionStore } from '../../../core/auth/session.store';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { ViewportService } from '../../../core/layout/viewport';
import { ReviewCountStore } from '../../../core/review/review-count.store';
import { ListState } from '../../../shared/ui/list-state';
import { PageProblem } from '../../../shared/ui/page-problem';
import { ScoreSearchSelect, type ChosenScore } from '../../../shared/ui/score-search-select';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { VoiceSelect } from '../../../shared/ui/voice-select';
import { clampCrop, initialPages, isTypingTarget, NO_CROP, rotate, toTransforms, type CropMargins, type PageState } from './review-model';
import { ReviewPreview } from './review-preview';
import { valueOr } from '../../../core/util/resource-value';

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Prüfung (N-12, N-13): queue, preview with paging, rotating and cropping, assignment of score
 * and voice, „Annehmen & weiter“ and „Ablehnen“ with a reason; shortcuts A, R and ←/→.
 */
@Component({
  selector: 'vm-library-review-page',
  imports: [VmCheckbox, VmField, VmFieldLabel, VmFieldError, 
    DatePipe,
    RouterLink,
    NgIcon,
    TranslocoPipe,
    PluralPipe,
    VmButton, VmIconButton,
    VmTextarea,
    ListState,
    PageProblem,
    ScoreSearchSelect,
    StatusBadge,
    VoiceSelect,
    ReviewPreview,
  ],
  viewProviders: [
    provideIcons({
      lucideChevronLeft,
      lucideChevronRight,
      lucideRotateCw,
      lucideCrop,
      lucideZoomIn,
      lucideZoomOut,
      lucidePanelLeftClose,
      lucidePanelLeftOpen,
    }),
  ],
  host: { '(document:keydown)': 'onKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review-page.html',
})
export class ReviewPage {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly reviewCount = inject(ReviewCountStore);
  private readonly transloco = inject(TranslocoService);
  protected readonly viewport = inject(ViewportService);

  /** Route parameter; without it the first upload of the queue opens. */
  readonly uploadId = input<string>();

  protected readonly queueOpen = signal(true);
  protected readonly total = signal(0);
  protected readonly queue = cursorList({
    params: () => null,
    fetch: (_p, cursor) =>
      this.api.get(apiUrl('review', 'queue'), reviewQueueResponseSchema, { cursor }).pipe(tap((page) => this.total.set(page.totalPending))),
  });

  protected readonly details = rxResource({
    params: () => this.uploadId(),
    stream: ({ params }) => this.api.get(apiUrl('review', 'uploadDetails', { uploadId: params }), uploadDetailsResponseSchema),
  });
  protected readonly upload = computed(() => valueOr(this.details, null));
  protected readonly pdfUrl = computed(() => {
    const id = this.uploadId();
    return id ? apiUrl('review', 'uploadPdf', { uploadId: id }) : null;
  });
  protected readonly position = computed(() => {
    const index = this.queue.items().findIndex((item) => item.uploadId === this.uploadId());
    return index < 0 ? null : index + 1;
  });

  // Edit state of the current upload.
  protected readonly score = signal<ChosenScore | null>(null);
  protected readonly voiceId = signal<string | null>(null);
  protected readonly reason = signal('');
  protected readonly replaceExisting = signal(false);
  protected readonly pages = signal<PageState[]>([]);
  protected readonly page = signal(1);
  protected readonly zoomIndex = signal(2);
  protected readonly cropping = signal(false);
  protected readonly busy = signal(false);
  protected readonly reasonMissing = signal(false);
  protected readonly announcement = signal('');

  protected readonly current = computed<PageState | null>(() => this.pages()[this.page() - 1] ?? null);
  protected readonly zoom = computed(() => ZOOM_STEPS[this.zoomIndex()]);
  protected readonly keptPages = computed(() => this.pages().filter((p) => p.keep).length);
  protected readonly canReplace = computed(() => this.session.can('score.delete'));
  protected readonly needsReplace = computed(() => !!this.upload()?.existingSheetId);
  protected readonly canApprove = computed(
    () => !!this.score() && !!this.voiceId() && this.keptPages() > 0 && (!this.needsReplace() || this.replaceExisting()) && !this.busy(),
  );

  private readonly reasonField = viewChild<string, ElementRef<HTMLTextAreaElement>>('reasonField', { read: ElementRef });

  constructor() {
    // /library/review without id → first upload of the queue.
    effect(() => {
      if (this.uploadId()) return;
      const first = this.queue.items()[0];
      if (first) untracked(() => this.openUpload(first.uploadId, true));
    });
    // New upload loaded → reset the edit state from it.
    effect(() => {
      const upload = this.upload();
      if (!upload) return;
      untracked(() => {
        this.score.set(upload.score ? { id: upload.score.id, title: upload.score.name } : null);
        this.voiceId.set(upload.voice?.id ?? null);
        this.reason.set('');
        this.reasonMissing.set(false);
        this.replaceExisting.set(false);
        this.pages.set(initialPages(upload.pageCount));
        this.page.set(1);
        this.cropping.set(false);
      });
    });
    onUploadCompleted(() => this.queue.reload());
  }

  protected link(item: ReviewQueueItem): string {
    return appPath(APP_ROUTES.library.reviewUpload, { uploadId: item.uploadId });
  }

  protected onPageCount(count: number): void {
    // The PDF may have a different count than stored (should not happen); trust the file.
    if (count !== this.pages().length) this.pages.set(initialPages(count));
  }

  protected goPage(delta: number): void {
    this.page.update((p) => Math.min(Math.max(1, p + delta), Math.max(1, this.pages().length)));
  }

  protected rotateCurrent(): void {
    this.updateCurrent((p) => ({ ...p, rotation: rotate(p.rotation), crop: null }));
    this.announcement.set(this.transloco.translate('review.rotated', { page: this.page(), degrees: this.current()?.rotation ?? 0 }));
  }

  protected toggleKeep(): void {
    this.updateCurrent((p) => ({ ...p, keep: !p.keep }));
  }

  protected setCrop(side: keyof CropMargins, value: string): void {
    this.updateCurrent((p) => ({ ...p, crop: clampCrop({ ...(p.crop ?? NO_CROP), [side]: Number(value) }) }));
  }

  protected resetCrop(): void {
    this.updateCurrent((p) => ({ ...p, crop: null }));
  }

  protected cropValue(side: keyof CropMargins): number {
    return this.current()?.crop?.[side] ?? 0;
  }

  protected zoomBy(delta: number): void {
    this.zoomIndex.update((i) => Math.min(Math.max(0, i + delta), ZOOM_STEPS.length - 1));
  }

  protected async approve(): Promise<void> {
    const upload = this.upload();
    const score = this.score();
    const voiceId = this.voiceId();
    if (!upload || !score || !voiceId || !this.canApprove()) return;
    this.busy.set(true);
    const done = await this.actions.runOnce(
      () =>
        this.api.post(
            apiUrl('review', 'approve', { uploadId: upload.uploadId }),
            { scoreId: score.id, voiceId, pages: toTransforms(this.pages()), replaceExisting: this.replaceExisting() },
            approveUploadResponseSchema,
          ),
      {
        success: { key: 'review.approved', params: { name: upload.fileName } },
        onProblem: (problem) => {
          if (isApiProblem(problem) && problem.code === 'upload-not-pending') {
            this.afterDecision(upload.nextUploadId);
          }
          return false;
        },
      },
    );
    this.busy.set(false);
    if (done) this.afterDecision(done.value.nextUploadId);
  }

  protected async reject(): Promise<void> {
    const upload = this.upload();
    if (!upload || this.busy()) return;
    if (!this.reason().trim()) {
      this.reasonMissing.set(true);
      this.reasonField()?.nativeElement.focus();
      return;
    }
    this.busy.set(true);
    const done = await this.actions.runOnce(
      () =>
        this.api.post(apiUrl('review', 'reject', { uploadId: upload.uploadId }), { reason: this.reason().trim() }, rejectUploadResponseSchema),
      { success: { key: 'review.rejected', params: { name: upload.fileName } } },
    );
    this.busy.set(false);
    if (done) this.afterDecision(done.value.nextUploadId);
  }

  protected openUpload(id: string | null | undefined, replaceUrl = false): void {
    if (!id) return;
    void this.router.navigateByUrl(appPath(APP_ROUTES.library.reviewUpload, { uploadId: id }), { replaceUrl });
  }

  /** N-13: A = annehmen, R = ablehnen (focuses the reason first), ←/→ = previous/next upload. */
  protected onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
    if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    const upload = this.upload();
    if (!upload) return;
    switch (event.key) {
      case 'a':
      case 'A':
        event.preventDefault();
        void this.approve();
        break;
      case 'r':
      case 'R':
        event.preventDefault();
        void this.reject();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.openUpload(upload.previousUploadId);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.openUpload(upload.nextUploadId);
        break;
    }
  }

  private afterDecision(nextId: string | null): void {
    this.reviewCount.refresh();
    this.queue.reload();
    if (nextId) this.openUpload(nextId, true);
    else void this.router.navigateByUrl(APP_ROUTES.library.review, { replaceUrl: true });
  }

  private updateCurrent(change: (page: PageState) => PageState): void {
    const index = this.page() - 1;
    this.pages.update((pages) => pages.map((p, i) => (i === index ? change(p) : p)));
  }
}
