import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

import { observeWidth } from '../../../shared/ui/observe-width';
import { loadPdfJs, PDFJS_BASE } from '../../../shared/ui/pdf-viewer';
import type { CropMargins, Rotation } from './review-model';

/**
 * Page of an upload as it will look after approval: rotated, zoomed, with the crop shown as
 * dimmed margins (N-12). Rotation and crop are only applied by the API on approval.
 */
@Component({
  selector: 'vm-review-preview',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1' },
  template: `
    <div #frame class="flex min-h-80 flex-1 items-start justify-center overflow-auto bg-muted p-4">
      @switch (state()) {
        @case ('loading') {
          <p class="self-center text-muted-foreground">{{ 'common.loading' | transloco }}</p>
        }
        @case ('error') {
          <p role="alert" class="self-center text-destructive-ink">{{ 'pdf.error' | transloco }}</p>
        }
      }
      <div class="relative shrink-0" [class.hidden]="state() !== 'ready'">
        <canvas #canvas class="block border bg-white shadow-sm" [class.opacity-40]="dimmed()" aria-hidden="true"></canvas>
        @if (crop(); as c) {
          <div
            aria-hidden="true"
            class="pointer-events-none absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(24,24,27,0.35)]"
            [style.left.%]="c.left"
            [style.top.%]="c.top"
            [style.right.%]="c.right"
            [style.bottom.%]="c.bottom"
          ></div>
        }
      </div>
    </div>
  `,
})
export class ReviewPreview {
  readonly src = input.required<string>();
  /** 1-based page. */
  readonly page = input(1);
  readonly rotation = input<Rotation>(0);
  readonly crop = input<CropMargins | null>(null);
  /** 1 = fit to width. */
  readonly zoom = input(1);
  /** Page left out of the sheet. */
  readonly dimmed = input(false);
  readonly pageCount = output<number>();

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);
  private task: PDFDocumentLoadingTask | undefined;
  private doc: PDFDocumentProxy | undefined;
  private renderTask: RenderTask | undefined;
  private loadId = 0;
  private rendered = false;

  constructor() {
    effect(() => {
      const src = this.src();
      untracked(() => void this.load(src));
    });
    effect(() => {
      this.page();
      this.rotation();
      this.zoom();
      untracked(() => void this.render());
    });
    afterNextRender(() => {
      this.destroyRef.onDestroy(observeWidth(this.frame().nativeElement, () => void this.render()));
      this.rendered = true;
      void this.render();
    });
    this.destroyRef.onDestroy(() => {
      this.renderTask?.cancel();
      void this.task?.destroy();
    });
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
      this.pageCount.emit(doc.numPages);
      await this.render();
      this.state.set('ready');
    } catch {
      if (id === this.loadId) this.state.set('error');
    }
  }

  private async render(): Promise<void> {
    const doc = this.doc;
    if (!doc || !this.rendered) return;
    const pageNumber = Math.min(Math.max(1, this.page()), doc.numPages);
    const page = await doc.getPage(pageNumber);
    const rotation = (page.rotate + this.rotation()) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    const available = this.frame().nativeElement.clientWidth - 32;
    const scale = Math.max(0.2, Math.min((available / base.width) * this.zoom(), 4));
    const ratio = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * ratio, rotation });
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
      // Cancelled by a newer render.
    }
  }
}
