import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';
import { apiUrl, configDefaultOptionsResponseSchema, type ConfigResponse } from '@vm-web/shared';

import { VmButton, VmCard, VmField, VmFieldLabel, VmSelect } from '@vm-web/ui';

import { ActionRunner } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { TreeLabelPipe } from '../../../shared/ui/tree-label.pipe';

/** Tab „Standardwerte“ (A-3): ensemble and role of new accounts; warning if that role has club permissions (B-1). */
@Component({
  selector: 'vm-defaults-settings',
  imports: [VmCard, VmField, VmFieldLabel, TreeLabelPipe, NgIcon, TranslocoPipe, VmButton, VmSelect],
  viewProviders: [provideIcons({ lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './defaults-settings.html',
})
export class DefaultsSettings {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);

  readonly config = input.required<ConfigResponse>();
  readonly readonly = input(false);
  readonly changed = output<void>();

  protected readonly options = rxResource({
    stream: () => this.api.get(apiUrl('system', 'configDefaultOptions'), configDefaultOptionsResponseSchema),
  });
  protected readonly ensembleId = signal('');
  protected readonly roleId = signal('');
  protected readonly dirty = computed(() => {
    const d = this.config().defaults;
    return (d.defaultEnsemble?.id ?? '') !== this.ensembleId() || (d.defaultRole?.id ?? '') !== this.roleId();
  });
  /** Live while choosing; the saved state comes as `warnings` from the API. */
  protected readonly warning = computed(() => {
    const role = this.options.hasValue() ? this.options.value().roles.find((r) => r.id === this.roleId()) : undefined;
    return role ? role.hasClubPermissions : this.config().warnings.includes('default-role-has-club-permissions') && !this.dirty();
  });

  constructor() {
    effect(() => {
      const d = this.config().defaults;
      untracked(() => {
        this.ensembleId.set(d.defaultEnsemble?.id ?? '');
        this.roleId.set(d.defaultRole?.id ?? '');
      });
    });
  }

  protected async save(): Promise<void> {
    const done = await this.actions.runOnce(
      () => this.api.postVoid(apiUrl('system', 'updateDefaults'), { defaultEnsembleId: this.ensembleId() || null, defaultRoleId: this.roleId() || null }),
      { success: { key: 'system.settings.saved' } },
    );
    if (done) this.changed.emit();
  }
}
