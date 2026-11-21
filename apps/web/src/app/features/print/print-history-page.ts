import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideCopy, lucidePrinter, lucideRepeat, lucideTriangleAlert, lucideX } from '@ng-icons/lucide';
import type { PrintJob, PrintJobStatus } from '@vm-web/shared';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardSonnerService } from '@/shared/components/sonner';

import { PluralPipe } from '../../core/i18n/plural.pipe';
import { ViewportService } from '../../core/layout/viewport';
import { PRINT_SERVICE, PrintServiceFailure, type PrintServiceState } from '../../core/print/print-service-client';
import { canRetry, isRunning, statusChanges } from './print-model';

/** Poll interval while the page is visible (docs/print-service.md). */
export const HISTORY_POLL_MS = 2000;

const STATUS_CLASSES: Record<PrintJobStatus, string> = {
  waiting: 'bg-muted text-muted-foreground',
  printing: 'bg-primary-soft text-primary',
  done: 'bg-success-soft text-success-ink',
  failed: 'bg-destructive-soft text-destructive-ink',
  cancelled: 'bg-muted text-muted-foreground',
};

/**
 * Druckverlauf (D-3, D-5): jobs of the local print service with their state, cancel and send again.
 * Without a running service it shows how to set it up. State changes are announced as toasts.
 */
@Component({
  selector: 'vm-print-history-page',
  imports: [DatePipe, NgTemplateOutlet, NgIcon, TranslocoPipe, PluralPipe, ZardButtonComponent],
  viewProviders: [provideIcons({ lucidePrinter, lucideCircleCheck, lucideTriangleAlert, lucideCopy, lucideRepeat, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './print-history-page.html',
})
export class PrintHistoryPage {
  private readonly service = inject(PRINT_SERVICE);
  private readonly sonner = inject(ZardSonnerService);
  private readonly transloco = inject(TranslocoService);
  protected readonly viewport = inject(ViewportService);

  /** `null` while the first check runs. */
  protected readonly state = signal<PrintServiceState | null>(null);
  protected readonly jobs = signal<readonly PrintJob[]>([]);
  protected readonly loaded = signal(false);
  protected readonly origin = typeof location === 'undefined' ? '' : location.origin;
  protected readonly ready = computed(() => this.state()?.kind === 'ready');
  protected readonly defaultPrinter = computed(() => {
    const state = this.state();
    return state?.kind === 'ready' ? (state.status.printers.find((p) => p.isDefault) ?? state.status.printers[0] ?? null) : null;
  });
  protected readonly printerCount = computed(() => {
    const state = this.state();
    return state?.kind === 'ready' ? state.status.printers.length : 0;
  });
  protected readonly isRunning = isRunning;
  protected readonly canRetry = canRetry;
  protected statusClass(status: PrintJobStatus): string {
    return STATUS_CLASSES[status];
  }

  private timer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;

  constructor() {
    void this.refresh();
    const visibility = () => {
      if (document.visibilityState === 'visible') void this.refresh();
    };
    document.addEventListener('visibilitychange', visibility);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.timer);
      document.removeEventListener('visibilitychange', visibility);
    });
  }

  /** Checks the service, loads the jobs and schedules the next poll while the page is visible. */
  protected async refresh(): Promise<void> {
    clearTimeout(this.timer);
    const state = await this.service.state();
    if (this.destroyed) return;
    this.state.set(state);
    if (state.kind === 'ready') {
      try {
        const jobs = await this.service.jobs();
        if (this.destroyed) return;
        if (this.loaded()) this.announce(this.jobs(), jobs);
        this.jobs.set(jobs);
      } catch {
        this.state.set({ kind: 'offline' });
      }
    }
    this.loaded.set(true);
    if (!this.destroyed && document.visibilityState === 'visible') this.timer = setTimeout(() => void this.refresh(), HISTORY_POLL_MS);
  }

  protected async cancel(job: PrintJob): Promise<void> {
    await this.act(() => this.service.cancel(job.id), 'print.history.cancelled');
  }

  protected async retry(job: PrintJob): Promise<void> {
    await this.act(() => this.service.retry(job.id), 'print.history.retried');
  }

  protected async copyOrigin(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.origin);
      this.sonner.success(this.transloco.translate('print.history.copied'));
    } catch {
      // Clipboard blocked: the address is visible on the page anyway.
    }
  }

  protected voices(job: PrintJob): string {
    return job.source.voices.length ? job.source.voices.join(', ') : this.transloco.translate('print.history.allVoices');
  }

  private async act(action: () => Promise<unknown>, successKey: string): Promise<void> {
    try {
      await action();
      this.sonner.success(this.transloco.translate(successKey));
    } catch (error) {
      const code = error instanceof PrintServiceFailure ? error.code : 'internal-error';
      this.sonner.error(this.transloco.translate(`print.serviceErrors.${code}`));
    }
    await this.refresh();
  }

  /** Toast per state change (D-5); also read by screen readers through the toast region. */
  private announce(before: readonly PrintJob[], after: readonly PrintJob[]): void {
    for (const { job, status } of statusChanges(before, after)) {
      const text = this.transloco.translate('print.history.changed', {
        title: job.source.title,
        status: this.transloco.translate(`print.jobStatus.${status}`),
      });
      if (status === 'failed') this.sonner.error(text, { description: job.error ?? undefined });
      else if (status === 'done') this.sonner.success(text);
      else this.sonner.info(text);
    }
  }
}
