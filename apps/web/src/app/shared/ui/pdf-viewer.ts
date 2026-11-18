import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

import { ZardButtonComponent } from '@/shared/components/button';

/** Where the pdf.js worker and its resources are served (copied by the build, see project.json). */
const PDFJS_BASE = '/pdfjs';

type PdfJs = typeof import('pdfjs-dist');
let pdfjs: Promise<PdfJs> | undefined;

/** pdf.js is loaded on first use only (≈ 400 kB), never in the initial bundle. */
function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= import('pdfjs-dist').then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
    return lib;
  });
  return pdfjs;
}

/** Page buttons are shown up to this count; above it only previous/next. */
export const MAX_PAGE_BUTTONS = 10;

export function clampPage(page: number, count: number): number {
  return Math.min(Math.max(1, Math.round(page)), Math.max(1, count));
}

/**
 * PDF preview with pdf.js (M-6, N-12): one page at a time, fitted to the width, with
 * previous/next, page buttons and arrow keys. The current page is announced politely.
 */
@Component({
  selector: 'vm-pdf-viewer',
  imports: [NgIcon, TranslocoPipe, ZardButtonComponent],
  viewProviders: [provideIcons({ lucideChevronLeft, lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `
    <div
      #frame
      tabindex="0"
      role="group"
      [attr.aria-label]="'pdf.label' | transloco: { page: page(), count: pageCount() }"
      (keydown.arrowleft)="go(page() - 1)"
      (keydown.arrowright)="go(page() + 1)"
      class="flex min-h-64 items-start justify-center overflow-auto rounded-md bg-muted p-2 md:p-4"
    >
      @switch (state()) {
        @case ('loading') {
          <p class="self-center text-muted-foreground">{{ 'common.loading' | transloco }}</p>
        }
        @case ('error') {
          <p role="alert" class="self-center text-destructive-ink">{{ 'pdf.error' | transloco }}</p>
        }
      }
      <canvas #canvas [class.hidden]="state() !== 'ready'" class="max-w-full border bg-white shadow-sm" aria-hidden="true"></canvas>
    </div>

    @if (pageCount() > 1) {
      <nav [attr.aria-label]="'pdf.pages' | transloco" class="flex flex-wrap items-center justify-center gap-1">
        <button z-button zType="ghost" zSize="icon" type="button" [disabled]="page() <= 1" (click)="go(page() - 1)" [attr.aria-label]="'pdf.previous' | transloco">
          <ng-icon name="lucideChevronLeft" aria-hidden="true" />
        </button>
        @if (pageCount() <= maxPageButtons) {
          @for (n of pages(); track n) {
            <button
              z-button
              [zType]="n === page() ? 'secondary' : 'ghost'"
              zSize="icon"
              type="button"
              class="tabular-nums"
              [attr.aria-current]="n === page() ? 'page' : null"
              [attr.aria-label]="'pdf.page' | transloco: { page: n }"
              (click)="go(n)"
            >
              {{ n }}
            </button>
          }
        }
        <button z-button zType="ghost" zSize="icon" type="button" [disabled]="page() >= pageCount()" (click)="go(page() + 1)" [attr.aria-label]="'pdf.next' | transloco">
          <ng-icon name="lucideChevronRight" aria-hidden="true" />
        </button>
      </nav>
    }
    <p class="text-center text-xs text-muted-foreground tabular-nums" aria-live="polite">
      @if (state() === 'ready') {
        {{ 'pdf.status' | transloco: { page: page(), count: pageCount() } }}
      }
    </p>
  `,
})
export class PdfViewer {
  /** URL of the PDF (same origin, cookie session). */
  readonly src = input.required<string>();

  protected readonly maxPageButtons = MAX_PAGE_BUTTONS;
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly page = signal(1);
  protected readonly pageCount = signal(0);
  protected readonly pages = signal<number[]>([]);

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private doc: PDFDocumentProxy | undefined;
  /** The loading task owns the document; destroying it frees the worker resources (pdf.js 6). */
  private task: PDFDocumentLoadingTask | undefined;
  private renderTask: RenderTask | undefined;
  private loadId = 0;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      const src = this.src();
      untracked(() => void this.load(src));
    });
    afterNextRender(() => {
      const observer = new ResizeObserver(() => void this.render());
      observer.observe(this.frame().nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
    this.destroyRef.onDestroy(() => {
      this.renderTask?.cancel();
      void this.task?.destroy();
    });
  }

  protected go(page: number): void {
    const next = clampPage(page, this.pageCount());
    if (next === this.page()) return;
    this.page.set(next);
    void this.render();
  }

  private async load(src: string): Promise<void> {
    const id = ++this.loadId;
    this.state.set('loading');
    this.renderTask?.cancel();
    await this.task?.destroy();
    this.task = undefined;
    this.doc = undefined;
    try {
      const lib = await loadPdfJs();
      const task = lib.getDocument({
        url: src,
        withCredentials: true,
        wasmUrl: `${PDFJS_BASE}/wasm/`,
        standardFontDataUrl: `${PDFJS_BASE}/standard_fonts/`,
        cMapUrl: `${PDFJS_BASE}/cmaps/`,
      });
      this.task = task;
      const doc = await task.promise;
      if (id !== this.loadId) {
        await task.destroy();
        return;
      }
      this.doc = doc;
      this.pageCount.set(doc.numPages);
      this.pages.set(Array.from({ length: doc.numPages }, (_, i) => i + 1));
      this.page.set(1);
      await this.render();
      this.state.set('ready');
    } catch {
      if (id === this.loadId) this.state.set('error');
    }
  }

  private async render(): Promise<void> {
    const doc = this.doc;
    if (!doc) return;
    const page = await doc.getPage(this.page());
    const frameWidth = this.frame().nativeElement.clientWidth - 32;
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(0.25, Math.min(frameWidth / base.width, 2.5));
    const ratio = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * ratio });
    const canvas = this.canvas().nativeElement;
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
    canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
    this.renderTask?.cancel();
    this.renderTask = page.render({ canvas, viewport });
    try {
      await this.renderTask.promise;
    } catch {
      // Cancelled by a newer render (resize, page change).
    }
  }
}
