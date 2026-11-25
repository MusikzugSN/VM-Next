import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideScissors, lucideX } from '@ng-icons/lucide';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import { VmButton, VmCheckbox } from '@vm-web/ui';

import { SessionStore } from '../../core/auth/session.store';
import { VoiceContextStore } from '../../core/voices/voice-context.store';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { loadPdfJs, PDFJS_ASSETS } from '../../shared/ui/pdf-viewer';
import { ScoreSearchSelect, type ChosenScore } from '../../shared/ui/score-search-select';
import { VoiceSelect } from '../../shared/ui/voice-select';
import {
  firstSection,
  partFileName,
  removeSectionAt,
  sectionIndexAt,
  sectionRanges,
  splitPdf,
  startSectionAt,
  updateSection,
  uploadRanges,
  type SplitRange,
  type SplitSection,
} from './split-model';

/** One part of a split PDF, ready for the upload list (N-18). */
export interface SplitPart {
  file: File;
  scoreId: string | null;
  scoreTitle: string | null;
  voiceId: string | null;
  from: number;
  to: number;
}

/** Rendered page width in CSS pixels; thumbnails are large enough to recognise title and voice. */
const PAGE_WIDTH = 560;

/**
 * Sammel-PDF aufteilen (N-18): all pages one below the other. „Neuer Abschnitt ab Seite n“ starts a
 * section that keeps score and voice of the previous one until they are changed in the side panel,
 * which always edits the section of the page in view. Sections can be skipped (cover pages).
 */
@Component({
  selector: 'vm-upload-split',
  imports: [VmCheckbox, NgIcon, TranslocoPipe, PluralPipe, VmButton, ScoreSearchSelect, VoiceSelect],
  viewProviders: [provideIcons({ lucideScissors, lucideX, lucideCircleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col gap-4' },
  templateUrl: './upload-split.html',
})
export class UploadSplit {
  private readonly session = inject(SessionStore);
  private readonly voices = inject(VoiceContextStore);
  private readonly voiceNames = computed(() => new Map(this.voices.options().flatMap((g) => g.voices.map((v) => [v.id, v.name] as const))));
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly file = input.required<File>();
  /** Score / voice the dialog was opened with (e.g. from a score page). */
  readonly preset = input<{ scoreId?: string; scoreTitle?: string; voiceId?: string }>({});
  readonly done = output<SplitPart[]>();
  readonly cancelled = output<void>();

  protected readonly pageWidth = PAGE_WIDTH;
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly pageCount = signal(0);
  protected readonly pages = computed(() => Array.from({ length: this.pageCount() }, (_, i) => i + 1));
  protected readonly sections = signal<SplitSection[]>([]);
  protected readonly currentPage = signal(1);
  protected readonly working = signal(false);
  protected readonly error = signal(false);
  protected readonly canCreateScore = computed(() => this.session.can('score.create'));
  private readonly sizes = signal(new Map<number, number>());

  protected readonly ranges = computed(() => sectionRanges(this.sections(), this.pageCount()));
  protected readonly current = computed<SplitRange | null>(() => this.ranges()[sectionIndexAt(this.sections(), this.currentPage())] ?? null);
  protected readonly partCount = computed(() => uploadRanges(this.sections(), this.pageCount()).length);
  protected readonly unassigned = computed(
    () => uploadRanges(this.sections(), this.pageCount()).filter((r) => !r.section.scoreId || !r.section.voiceId).length,
  );

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private doc: PDFDocumentProxy | undefined;
  private bytes: ArrayBuffer | undefined;
  private readonly rendered = new Set<number>();
  private observer: IntersectionObserver | undefined;
  private frame = 0;
  private pinnedUntil = 0;

  constructor() {
    afterNextRender(() => void this.load());
    this.destroyRef.onDestroy(() => {
      this.observer?.disconnect();
      cancelAnimationFrame(this.frame);
      void this.doc?.loadingTask.destroy();
    });
  }

  protected sectionOf(page: number): SplitSection {
    return this.sections()[sectionIndexAt(this.sections(), page)];
  }

  protected sectionLabel(section: SplitSection): string {
    if (section.skip) return 'upload.split.skipped';
    return section.scoreTitle ? 'upload.split.forScore' : 'upload.split.noScore';
  }

  /** „ · Trompete 1 in B“ – sections of one score differ only in the voice. */
  protected voiceSuffix(section: SplitSection): string {
    const name = !section.skip && section.voiceId ? this.voiceNames().get(section.voiceId) : undefined;
    return name ? ` · ${name}` : '';
  }

  protected ratio(page: number): string {
    return String(this.sizes().get(page) ?? 1 / Math.SQRT2);
  }

  protected chosen(section: SplitSection): ChosenScore | null {
    return section.scoreId && section.scoreTitle ? { id: section.scoreId, title: section.scoreTitle } : null;
  }

  /** Starts a section and brings its first page to the top, so the panel edits the new section. */
  protected startAt(page: number): void {
    this.sections.update((s) => startSectionAt(s, page));
    this.scrollTo(page);
  }

  protected removeAt(page: number): void {
    this.sections.update((s) => removeSectionAt(s, page));
  }

  protected patch(start: number, patch: Partial<Omit<SplitSection, 'start'>>): void {
    this.sections.update((s) => updateSection(s, start, patch));
  }

  protected setScore(start: number, score: ChosenScore | null): void {
    this.patch(start, { scoreId: score?.id ?? null, scoreTitle: score?.title ?? null });
  }

  protected scrollTo(page: number): void {
    const el = this.scroller().nativeElement.querySelector<HTMLElement>(`[data-page="${page}"]`);
    // The last pages cannot reach the top; the scroll events of this jump must not move the panel away.
    this.pinnedUntil = performance.now() + 500;
    el?.scrollIntoView({ block: 'start' });
    this.currentPage.set(page);
  }

  /** The page in view is the last one whose top is above the upper third of the scroll area. */
  protected onScroll(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      if (performance.now() < this.pinnedUntil) return;
      const box = this.scroller().nativeElement;
      const line = box.getBoundingClientRect().top + box.clientHeight / 3;
      let page = 1;
      for (const el of Array.from(box.querySelectorAll<HTMLElement>('[data-page]'))) {
        if (el.getBoundingClientRect().top <= line) page = Number(el.dataset['page']);
        else break;
      }
      this.currentPage.set(page);
    });
  }

  protected async apply(): Promise<void> {
    if (!this.bytes) return;
    this.working.set(true);
    this.error.set(false);
    try {
      const ranges = uploadRanges(this.sections(), this.pageCount());
      const parts = await splitPdf(this.bytes.slice(0), ranges);
      const name = this.file().name;
      this.done.emit(
        ranges.map((range, i) => ({
          file: new File([parts[i] as BlobPart], partFileName(name, range.from, range.to), { type: 'application/pdf' }),
          scoreId: range.section.scoreId,
          scoreTitle: range.section.scoreTitle,
          voiceId: range.section.voiceId,
          from: range.from,
          to: range.to,
        })),
      );
    } catch {
      this.error.set(true);
    } finally {
      this.working.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      this.bytes = await this.file().arrayBuffer();
      const lib = await loadPdfJs();
      // pdf.js takes over (detaches) the buffer it gets, so it reads a copy.
      this.doc = await lib.getDocument({
        data: new Uint8Array(this.bytes.slice(0)),
        ...PDFJS_ASSETS,
      }).promise;
      this.sections.set(firstSection(this.preset()));
      this.pageCount.set(this.doc.numPages);
      this.state.set('ready');
      // Pages are rendered when they come close to the visible area.
      afterNextRender(() => this.observe(), { injector: this.injector });
    } catch {
      this.state.set('error');
    }
  }

  private observe(): void {
    const root = this.scroller().nativeElement;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) void this.render(Number((entry.target as HTMLElement).dataset['canvas']), entry.target as HTMLCanvasElement);
        }
      },
      { root, rootMargin: '800px 0px' },
    );
    root.querySelectorAll('canvas[data-canvas]').forEach((canvas) => observer.observe(canvas));
    this.observer = observer;
  }

  private async render(pageNumber: number, canvas: HTMLCanvasElement): Promise<void> {
    if (!this.doc || this.rendered.has(pageNumber)) return;
    this.rendered.add(pageNumber);
    this.observer?.unobserve(canvas);
    try {
      const page = await this.doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      this.sizes.update((m) => new Map(m).set(pageNumber, base.width / base.height));
      const scale = (PAGE_WIDTH / base.width) * (window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;
    } catch {
      this.rendered.delete(pageNumber);
    }
  }
}
