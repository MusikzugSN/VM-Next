import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiUrl, updatePrintBodySchema, type ConfigResponse } from '@vm-web/shared';

import { VmButton, VmCard, VmField, VmFieldLabel, VmInput } from '@vm-web/ui';

import { ActionRunner } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';

/** Tab „Drucken“ (D-2, D-4): page limit of the browser print and the address the print service accepts. */
@Component({
  selector: 'vm-print-settings',
  imports: [VmCard, VmField, VmFieldLabel, TranslocoPipe, VmButton, VmInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './print-settings.html',
})
export class PrintSettings {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);

  readonly config = input.required<ConfigResponse>();
  readonly readonly = input(false);
  readonly changed = output<void>();

  protected readonly pageLimit = signal('');
  protected readonly baseUrl = signal('');
  protected readonly error = signal<'pageLimit' | 'publicBaseUrl' | null>(null);

  constructor() {
    effect(() => {
      const print = this.config().print;
      untracked(() => {
        this.pageLimit.set(String(print.browserPrintPageLimit));
        this.baseUrl.set(print.publicBaseUrl ?? '');
      });
    });
  }

  protected async save(): Promise<void> {
    const parsed = updatePrintBodySchema.safeParse({ browserPrintPageLimit: Number(this.pageLimit()), publicBaseUrl: this.baseUrl().trim() || null });
    if (!parsed.success) {
      this.error.set(parsed.error.issues[0]?.path[0] === 'publicBaseUrl' ? 'publicBaseUrl' : 'pageLimit');
      return;
    }
    const done = await this.actions.runOnce(() => this.api.postVoid(apiUrl('system', 'updatePrint'), parsed.data), {
      success: { key: 'system.settings.saved' },
    });
    if (done) this.changed.emit();
  }
}
