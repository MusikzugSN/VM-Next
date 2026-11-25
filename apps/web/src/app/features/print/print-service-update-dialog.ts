import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideLoaderCircle, lucideTriangleAlert } from '@ng-icons/lucide';
import { PRINT_SERVICE_RELEASES, compareVersions, isReleaseVersion } from '@vm-web/shared';

import { VmButton, VmDialogImports } from '@vm-web/ui';

import { APP_VERSION } from '../../core/app-version';
import { PRINT_SERVICE, PrintServiceFailure } from '../../core/print/print-service-client';

/** After POST /update the service restarts (systemd waits 5 s); it must report the new version within this time. */
export const RESTART_TIMEOUT_MS = 60_000;
export const RESTART_POLL_MS = 1000;

type Phase =
  /** The service is older: offer the update. `service` is `null` when only the contract told us. */
  | { kind: 'older'; service: string | null }
  /** The service is newer than VM-Web: it never downgrades, so only tell. */
  | { kind: 'newer'; service: string }
  | { kind: 'updating' }
  | { kind: 'done' }
  | { kind: 'failed'; code: string };

/** Failures that need the archive installed by hand (services before POST /update, dev builds). */
const MANUAL = new Set(['update-unavailable', 'update-unsupported']);
const KNOWN_ERRORS = new Set(['update-unavailable', 'update-unsupported', 'update-failed', 'update-running', 'restart-timeout', 'offline']);

/**
 * Compares the local print service with this VM-Web once on start (docs/print-service.md › Update)
 * and offers to update it when the versions differ. Silent when the service isn't running, was
 * never seen in this browser, or either side is a development build.
 */
@Component({
  selector: 'vm-print-service-update-dialog',
  imports: [NgIcon, TranslocoPipe, VmButton, VmDialogImports],
  viewProviders: [provideIcons({ lucideCircleCheck, lucideLoaderCircle, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @let p = phase();
    @if (p) {
      <vm-dialog [(zVisible)]="open" zWidth="34rem" [zClosable]="p.kind !== 'updating'" [zMaskClosable]="p.kind !== 'updating'">
        <vm-dialog-header>
          <h2 vm-dialog-title>{{ 'print.update.title.' + p.kind | transloco }}</h2>
        </vm-dialog-header>

        <div class="flex flex-col gap-4" aria-live="polite">
          @switch (p.kind) {
            @case ('older') {
              <p>
                {{ (p.service ? 'print.update.older' : 'print.update.olderUnknown') | transloco: { service: p.service, app: appVersion } }}
              </p>
            }
            @case ('newer') {
              <p>{{ 'print.update.newer' | transloco: { service: p.service, app: appVersion } }}</p>
            }
            @case ('updating') {
              <p role="status" class="flex items-center gap-3">
                <ng-icon name="lucideLoaderCircle" size="24" class="shrink-0 animate-spin text-primary" aria-hidden="true" />
                {{ 'print.update.updating' | transloco: { app: appVersion } }}
              </p>
            }
            @case ('done') {
              <p role="status" class="flex items-start gap-3">
                <ng-icon name="lucideCircleCheck" size="24" class="shrink-0 text-success" aria-hidden="true" />
                {{ 'print.update.done' | transloco: { app: appVersion } }}
              </p>
            }
            @case ('failed') {
              <p role="alert" class="flex items-start gap-2 rounded-small bg-warning-soft p-4 text-warning-ink">
                <ng-icon name="lucideTriangleAlert" class="mt-0.5 shrink-0" aria-hidden="true" />
                {{ 'print.update.errors.' + errorKey() | transloco }}
              </p>
              @if (manual()) {
                <ol class="flex list-decimal flex-col gap-2 ps-5">
                  <li>
                    {{ 'print.update.manual.download' | transloco }}
                    <a class="font-medium text-primary underline" [href]="releaseUrl" target="_blank" rel="noopener">{{ 'print.update.manual.release' | transloco: { app: appVersion } }}</a>
                  </li>
                  <li>
                    {{ 'print.update.manual.install' | transloco }}
                    <code class="rounded-small bg-muted px-2 py-1 font-mono text-body-medium">./install.sh</code>
                  </li>
                </ol>
              }
            }
          }
        </div>

        <vm-dialog-footer>
          @switch (p.kind) {
            @case ('older') {
              <button vm-button variant="tonal" type="button" (click)="open.set(false)">{{ 'print.update.later' | transloco }}</button>
              <button vm-button type="button" (click)="update()">{{ 'print.update.start' | transloco }}</button>
            }
            @case ('updating') {
              <button vm-button type="button" [zLoading]="true" [zDisabled]="true">{{ 'print.update.start' | transloco }}</button>
            }
            @case ('done') {
              <button vm-button type="button" (click)="open.set(false)">{{ 'print.update.continue' | transloco }}</button>
            }
            @case ('failed') {
              <button vm-button variant="tonal" type="button" (click)="open.set(false)">{{ 'common.close' | transloco }}</button>
              @if (!manual()) {
                <button vm-button type="button" (click)="update()">{{ 'common.retry' | transloco }}</button>
              }
            }
            @default {
              <button vm-button type="button" (click)="open.set(false)">{{ 'common.close' | transloco }}</button>
            }
          }
        </vm-dialog-footer>
      </vm-dialog>
    }
  `,
})
export class PrintServiceUpdateDialog {
  private readonly service = inject(PRINT_SERVICE);
  protected readonly appVersion = inject(APP_VERSION);
  protected readonly releaseUrl = `${PRINT_SERVICE_RELEASES}/tag/v${this.appVersion}`;

  protected readonly open = signal(false);
  protected readonly phase = signal<Phase | null>(null);

  private readonly failedCode = computed(() => {
    const p = this.phase();
    return p?.kind === 'failed' ? p.code : null;
  });
  protected readonly errorKey = computed(() => {
    const code = this.failedCode();
    return code && KNOWN_ERRORS.has(code) ? code : 'other';
  });
  protected readonly manual = computed(() => MANUAL.has(this.failedCode() ?? ''));

  /** Resolves when the start check is done (for tests). */
  readonly checked: Promise<void>;

  constructor() {
    this.checked = this.check();
  }

  private async check(): Promise<void> {
    if (!isReleaseVersion(this.appVersion) || !this.service.seenBefore()) return;
    const state = await this.service.state();
    let phase: Phase | null = null;
    if (state.kind === 'incompatible' && state.reason === 'contract') {
      phase = { kind: 'older', service: null };
    } else if (state.kind === 'ready' && isReleaseVersion(state.status.version)) {
      const diff = compareVersions(state.status.version, this.appVersion);
      if (diff < 0) phase = { kind: 'older', service: state.status.version };
      else if (diff > 0) phase = { kind: 'newer', service: state.status.version };
    }
    if (!phase) return;
    this.phase.set(phase);
    this.open.set(true);
  }

  protected async update(): Promise<void> {
    if (this.phase()?.kind === 'updating') return;
    this.phase.set({ kind: 'updating' });
    try {
      await this.service.update(this.appVersion);
    } catch (error) {
      this.phase.set({ kind: 'failed', code: error instanceof PrintServiceFailure ? error.code : 'other' });
      return;
    }
    this.phase.set((await this.waitForRestart()) ? { kind: 'done' } : { kind: 'failed', code: 'restart-timeout' });
  }

  /** Polls the status until the restarted service reports this VM-Web's version. */
  private async waitForRestart(): Promise<boolean> {
    const until = Date.now() + RESTART_TIMEOUT_MS;
    while (Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, RESTART_POLL_MS));
      const state = await this.service.state();
      if (state.kind === 'ready' && state.status.version === this.appVersion) return true;
    }
    return false;
  }
}
