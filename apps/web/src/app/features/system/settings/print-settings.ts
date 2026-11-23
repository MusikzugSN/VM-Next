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
  template: `
    <form vm-card class="flex flex-col gap-4 p-4 md:p-6" novalidate (submit)="$event.preventDefault(); save()">
      <h2 class="text-title-large">{{ 'system.settings.print.title' | transloco }}</h2>
      <label vm-field class="md:w-60">
        <span vm-field-label>{{ 'system.settings.print.pageLimit' | transloco }}</span>
        <input
          vm-input
          type="number"
          min="1"
          max="500"
          inputmode="numeric"
          [readOnly]="readonly()"
          [value]="pageLimit()"
          (input)="pageLimit.set($any($event.target).value); error.set(null)"
          [attr.aria-invalid]="error() === 'pageLimit'"
          aria-describedby="hint-pageLimit"
        />
        <span id="hint-pageLimit" class="text-body-medium" [class]="error() === 'pageLimit' ? 'text-destructive-ink' : 'text-muted-foreground'">{{
          'system.settings.print.pageLimitHint' | transloco
        }}</span>
      </label>
      <label vm-field>
        <span vm-field-label>{{ 'system.settings.print.publicBaseUrl' | transloco }}</span>
        <input
          vm-input
          type="url"
          maxlength="500"
          placeholder="https://"
          [readOnly]="readonly()"
          [value]="baseUrl()"
          (input)="baseUrl.set($any($event.target).value); error.set(null)"
          [attr.aria-invalid]="error() === 'publicBaseUrl'"
          aria-describedby="hint-baseUrl"
        />
        <span id="hint-baseUrl" class="text-body-medium" [class]="error() === 'publicBaseUrl' ? 'text-destructive-ink' : 'text-muted-foreground'">{{
          'system.settings.print.publicBaseUrlHint' | transloco
        }}</span>
      </label>
      @if (!readonly()) {
        <button vm-button type="submit" class="self-end">{{ 'common.save' | transloco }}</button>
      }
    </form>
  `,
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
