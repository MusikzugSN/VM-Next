import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCircleAlert, lucideExternalLink, lucidePrinter, lucideRepeat, lucideShare2, lucideTriangleAlert, lucideX } from '@ng-icons/lucide';
import { APP_ROUTES, PRINT_SERVICE_CONTRACT, apiUrl, printPlanResponseSchema, type VoiceRef } from '@vm-web/shared';
import { firstValueFrom, from } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardDialogImports } from '@/shared/components/dialog/dialog.imports';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';
import { ZardSonnerService } from '@/shared/components/sonner';

import { PrintLauncher, type PrintRequest } from '../../core/actions/pending-features';
import { ApiClient } from '../../core/api/api-client';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { isApiProblem } from '../../core/api/api-problem';
import { ViewportService } from '../../core/layout/viewport';
import { openPdfTab, printFileName, printPdf, sharePdf } from '../../core/print/browser-print';
import { PRINT_SERVICE, PrintServiceFailure } from '../../core/print/print-service-client';
import { VoiceContextStore } from '../../core/voices/voice-context.store';
import { ToggleField } from '../../shared/ui/toggle-field';
import { VoiceSelect } from '../../shared/ui/voice-select';
import { planScores, printQuery, sheetsLabel, type PrintOptions } from './print-model';

/**
 * Druckdialog (D-1 bis D-3, M-7): scope, voices, duplex and substitutes; shows how each score lands
 * on paper and decides up front between browser printing (up to the page limit) and the local
 * print service. Without a running service it warns and offers the browser (D-3). On phones and
 * tablets the PDF is opened or shared instead – printing works through the device there.
 */
@Component({
  selector: 'vm-print-dialog',
  imports: [RouterLink, NgIcon, TranslocoPipe, PluralPipe, ZardButtonComponent, ZardDialogImports, ZardNativeSelectDirective, ToggleField, VoiceSelect],
  viewProviders: [provideIcons({ lucidePrinter, lucideCheck, lucideCircleAlert, lucideTriangleAlert, lucideExternalLink, lucideShare2, lucideRepeat, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog renders in an overlay; its host must not take up space in the shell.
  host: { style: 'display: contents' },
  templateUrl: './print-dialog.html',
})
export class PrintDialog {
  private readonly api = inject(ApiClient);
  private readonly launcher = inject(PrintLauncher);
  private readonly service = inject(PRINT_SERVICE);
  private readonly sonner = inject(ZardSonnerService);
  private readonly transloco = inject(TranslocoService);
  private readonly voices = inject(VoiceContextStore);
  protected readonly viewport = inject(ViewportService);

  protected readonly historyPath = APP_ROUTES.print.root;
  protected readonly open = signal(false);
  protected readonly request = signal<PrintRequest | null>(null);

  // Choices
  protected readonly mode = signal<PrintOptions['mode']>('all');
  protected readonly selectedScores = signal<ReadonlySet<string>>(new Set());
  protected readonly voiceIds = signal<readonly string[]>([]);
  /** Voices offered as chips: active, profile, preselected and added ones. */
  protected readonly voiceChoices = signal<readonly VoiceRef[]>([]);
  protected readonly duplex = signal(true);
  protected readonly withSubstitutes = signal(true);
  protected readonly printerId = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly options = computed<PrintOptions>(() => ({
    mode: this.mode(),
    scoreIds: [...this.selectedScores()],
    voiceIds: this.voiceIds(),
    duplex: this.duplex(),
    substitutes: this.withSubstitutes() ? 'fallback' : 'none',
  }));
  protected readonly ready = computed(() => this.voiceIds().length > 0 && (this.mode() === 'all' || this.selectedScores().size > 0));

  /** Plan of the whole folder/event: the list for „Auswahl“. */
  private readonly fullPlan = rxResource({
    params: () => {
      const request = this.request();
      return request && (request.scope === 'folder' || request.scope === 'event') && this.open() && this.voiceIds().length ? { request, options: { ...this.options(), mode: 'all' as const } } : undefined;
    },
    stream: ({ params }) => this.api.get(apiUrl('print', 'printPlan'), printPlanResponseSchema, printQuery(params.request, params.options)),
  });
  protected readonly selectableScores = computed(() => (this.fullPlan.hasValue() ? planScores(this.fullPlan.value()) : []));

  /** Plan of the current choice: pages, route, documents, missing voices. */
  protected readonly plan = rxResource({
    params: () => {
      const request = this.request();
      return request && this.open() && this.ready() ? { request, options: this.options() } : undefined;
    },
    stream: ({ params }) => this.api.get(apiUrl('print', 'printPlan'), printPlanResponseSchema, printQuery(params.request, params.options)),
  });
  protected readonly current = computed(() => (this.plan.hasValue() && this.ready() ? this.plan.value() : null));

  /** The print service is asked only when the plan needs it (D-3). */
  protected readonly serviceState = rxResource({
    params: () => (this.current()?.route === 'print-service' && !this.viewport.isMobile() ? this.request() : undefined),
    stream: () => from(this.service.state()),
  });
  protected readonly printers = computed(() => {
    const state = this.serviceState.hasValue() ? this.serviceState.value() : null;
    return state?.kind === 'ready' ? state.status.printers : [];
  });
  /** What the main button does. */
  protected readonly action = computed<'browser' | 'service' | 'fallback' | 'device' | null>(() => {
    const plan = this.current();
    if (!plan) return null;
    if (!this.viewport.isDesktop()) return 'device';
    if (plan.route === 'browser') return 'browser';
    if (this.serviceState.isLoading()) return null;
    const state = this.serviceState.hasValue() ? this.serviceState.value() : null;
    return state?.kind === 'ready' ? 'service' : 'fallback';
  });
  protected readonly canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  constructor() {
    effect(() => {
      const request = this.launcher.request();
      untracked(() => {
        if (request && !this.open()) this.start(request);
      });
    });
    effect(() => {
      if (!this.open()) untracked(() => this.launcher.close());
    });
    // Preselect the system's default printer once the service answered.
    effect(() => {
      const printers = this.printers();
      untracked(() => {
        if (!printers.some((p) => p.id === this.printerId())) this.printerId.set(printers.find((p) => p.isDefault)?.id ?? printers[0]?.id ?? null);
      });
    });
    // „Auswahl“ starts with every score of the folder/event.
    effect(() => {
      const scores = this.selectableScores();
      untracked(() => {
        if (this.selectedScores().size === 0 && scores.length) this.selectedScores.set(new Set(scores.map((s) => s.scoreId)));
      });
    });
  }

  private start(request: PrintRequest): void {
    const active = this.voices.activeVoices();
    const preselected = request.voiceIds?.length ? [...request.voiceIds] : active.map((v) => v.id);
    const known = new Map([...active, ...this.voices.profileVoices()].map((v) => [v.id, v]));
    for (const id of preselected) if (!known.has(id)) known.set(id, this.voiceRef(id));
    this.request.set(request);
    this.mode.set('all');
    this.selectedScores.set(new Set());
    this.voiceChoices.set([...known.values()]);
    this.voiceIds.set(preselected);
    this.duplex.set(true);
    this.withSubstitutes.set(true);
    this.open.set(true);
  }

  protected toggleVoice(id: string): void {
    this.voiceIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(0, 20)));
  }

  protected addVoice(id: string | null): void {
    if (!id) return;
    if (!this.voiceChoices().some((v) => v.id === id)) this.voiceChoices.update((list) => [...list, this.voiceRef(id)]);
    if (!this.voiceIds().includes(id)) this.toggleVoice(id);
  }

  protected toggleScore(id: string): void {
    this.selectedScores.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected sheets(pages: number, blank: number) {
    return sheetsLabel(pages, blank, this.duplex());
  }

  protected recheckService(): void {
    this.serviceState.reload();
  }

  /** Main button: browser print, print service, or – on phones – open the PDF. */
  protected async run(): Promise<void> {
    const action = this.action();
    if (!action || this.busy()) return;
    if (action === 'device') return this.openOnDevice();
    if (action === 'service') return this.sendToService();
    return this.printInBrowser();
  }

  protected async printInBrowser(): Promise<void> {
    const pdf = await this.loadPdf();
    if (!pdf) return;
    try {
      await printPdf(pdf);
      this.open.set(false);
    } catch {
      this.toastError('print.browserFailed');
    }
  }

  protected async openOnDevice(): Promise<void> {
    // Open the tab within the click, otherwise pop-up blockers stop it.
    const tab = openPdfTab();
    const pdf = await this.loadPdf();
    if (!pdf) return tab.close();
    tab.load(pdf);
    this.open.set(false);
  }

  protected async share(): Promise<void> {
    const pdf = await this.loadPdf();
    if (!pdf) return;
    if (await sharePdf(pdf, this.fileName())) this.open.set(false);
    else this.toastError('print.shareUnsupported');
  }

  private async sendToService(): Promise<void> {
    const request = this.request();
    const plan = this.current();
    if (!request || !plan) return;
    const pdf = await this.loadPdf();
    if (!pdf) return;
    this.busy.set(true);
    try {
      await this.service.submit(pdf, {
        contract: PRINT_SERVICE_CONTRACT,
        source: { kind: this.mode() === 'selection' && request.scope !== 'score' ? 'selection' : request.scope, title: request.title || '–', voices: this.voiceNames() },
        printerId: this.printerId(),
        pages: plan.totalPages,
        duplex: this.duplex(),
        copies: 1,
      });
      this.sonner.success(this.transloco.translate('print.sent'), { description: this.transloco.translate('print.sentHint') });
      this.open.set(false);
    } catch (error) {
      this.toastError(error instanceof PrintServiceFailure ? `print.serviceErrors.${error.code}` : 'print.serviceErrors.internal-error');
      this.serviceState.reload();
    } finally {
      this.busy.set(false);
    }
  }

  private async loadPdf(): Promise<Blob | null> {
    const request = this.request();
    if (!request) return null;
    this.busy.set(true);
    try {
      return await firstValueFrom(this.api.getBlob(apiUrl('print', 'printDocument'), printQuery(request, this.options())));
    } catch (error) {
      this.toastError(isApiProblem(error) ? error.messageKey : 'errors.unknown');
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  private voiceNames(): string[] {
    const ids = new Set(this.voiceIds());
    return this.voiceChoices()
      .filter((v) => ids.has(v.id))
      .map((v) => v.name);
  }

  private fileName(): string {
    return printFileName(this.request()?.title ?? '', this.voiceNames());
  }

  private voiceRef(id: string): VoiceRef {
    for (const group of this.voices.options()) {
      const voice = group.voices.find((v) => v.id === id);
      if (voice) return { id, name: voice.name, instrumentId: group.instrument.id };
    }
    return { id, name: '–', instrumentId: '' };
  }

  private toastError(key: string): void {
    this.sonner.error(this.transloco.translate(key));
  }
}
