import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';
import { apiUrl, configDefaultOptionsResponseSchema, type ConfigResponse } from '@vm-web/shared';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';

import { ActionRunner } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { TreeLabelPipe } from '../../../shared/ui/tree-label.pipe';

/** Tab „Standardwerte“ (A-3): ensemble and role of new accounts; warning if that role has club permissions (B-1). */
@Component({
  selector: 'vm-defaults-settings',
  imports: [TreeLabelPipe, NgIcon, TranslocoPipe, ZardButtonComponent, ZardNativeSelectDirective],
  viewProviders: [provideIcons({ lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm md:p-6" (submit)="$event.preventDefault(); save()">
      <div>
        <h2 class="text-lg font-semibold">{{ 'system.settings.defaults.title' | transloco }}</h2>
        <p class="text-muted-foreground">{{ 'system.settings.defaults.hint' | transloco }}</p>
      </div>
      @if (warning()) {
        <div role="status" class="flex items-start gap-2 rounded-lg bg-destructive-soft p-4 text-destructive-ink">
          <ng-icon name="lucideTriangleAlert" class="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{{ 'system.settings.defaults.clubWarning' | transloco }}</span>
        </div>
      }
      <div class="grid gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-1.5">
          <span class="font-medium">{{ 'system.settings.defaults.ensemble' | transloco }}</span>
          <select z-native-select [disabled]="readonly()" [value]="ensembleId()" (change)="ensembleId.set($any($event.target).value)">
            <option value="">{{ 'system.settings.defaults.none' | transloco }}</option>
            @for (e of options.hasValue() ? options.value().ensembles : []; track e.id) {
              <option [value]="e.id" [selected]="e.id === ensembleId()">{{ e | treeLabel }}</option>
            }
          </select>
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="font-medium">{{ 'system.settings.defaults.role' | transloco }}</span>
          <select z-native-select [disabled]="readonly()" [value]="roleId()" (change)="roleId.set($any($event.target).value)">
            <option value="">{{ 'system.settings.defaults.none' | transloco }}</option>
            @for (r of options.hasValue() ? options.value().roles : []; track r.id) {
              <option [value]="r.id" [selected]="r.id === roleId()">{{ r.name }}</option>
            }
          </select>
        </label>
      </div>
      <p class="text-[13px] text-muted-foreground">{{ 'system.settings.defaults.noneHint' | transloco }}</p>
      @if (!readonly()) {
        <button z-button type="submit" class="self-end" [zDisabled]="!dirty()">{{ 'common.save' | transloco }}</button>
      }
    </form>
  `,
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
