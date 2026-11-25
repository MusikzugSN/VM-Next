import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { LegalOperator, PrivacyData } from '@vm-web/shared';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';

import { VmField, VmFieldError, VmFieldLabel, VmSelect } from '@vm-web/ui';

import { ToggleField } from '../../../../shared/ui/toggle-field';
import { LegalChoice, type LegalChoiceOption } from './legal-choice';
import { LegalField } from './legal-field';
import { COUNTRY_CODES, countryName, GERMAN_STATES, type FieldChange } from './legal-model';

const OPERATORS: readonly LegalChoiceOption<LegalOperator>[] = [
  { value: 'self', labelKey: 'system.settings.legal.operator.self' },
  { value: 'provider', labelKey: 'system.settings.legal.operator.provider' },
];
const YES_NO: readonly LegalChoiceOption<boolean>[] = [
  { value: true, labelKey: 'system.settings.legal.yes' },
  { value: false, labelKey: 'system.settings.legal.no' },
];

/** Data of the privacy policy (S-7); the controller comes from the imprint data. */
@Component({
  selector: 'vm-privacy-data-form',
  imports: [TranslocoPipe, NgIcon, VmField, VmFieldError, VmFieldLabel, VmSelect, ToggleField, LegalChoice, LegalField],
  viewProviders: [provideIcons({ lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  template: `
    @let d = data();

    <section class="flex flex-col gap-4" aria-labelledby="legal-dpo">
      <h4 id="legal-dpo" class="text-title-small">{{ 'system.settings.legal.groups.dpo' | transloco }}</h4>
      <vm-toggle-field
        [label]="'system.settings.legal.hasDpo' | transloco"
        [hint]="'system.settings.legal.hints.dpo' | transloco"
        [checked]="!!d.dataProtectionOfficer"
        [disabled]="readonly()"
        (toggled)="setValue('dataProtectionOfficer', $event ? { name: '', contact: '' } : null)"
      />
      @if (d.dataProtectionOfficer; as dpo) {
        <div class="grid gap-4 sm:grid-cols-2">
          <vm-legal-field
            path="privacy.dataProtectionOfficer.name"
            [required]="true"
            [maxlength]="100"
            [value]="dpo.name"
            [error]="err('dataProtectionOfficer/name')"
            [readonly]="readonly()"
            (valueChange)="setValue('dataProtectionOfficer.name', $event)"
          />
          <vm-legal-field
            path="privacy.dataProtectionOfficer.contact"
            [required]="true"
            [maxlength]="300"
            hintKey="system.settings.legal.hints.dpoContact"
            [value]="dpo.contact"
            [error]="err('dataProtectionOfficer/contact')"
            [readonly]="readonly()"
            (valueChange)="setValue('dataProtectionOfficer.contact', $event)"
          />
        </div>
      }
    </section>

    @for (service of services; track service) {
      @let s = d[service];
      <section class="flex flex-col gap-4" [attr.aria-labelledby]="'legal-' + service">
        <h4 [id]="'legal-' + service" class="text-title-small">{{ 'system.settings.legal.groups.' + service | transloco }}</h4>
        <vm-legal-choice
          [legendKey]="'system.settings.legal.fields.privacy.' + service + '.operator'"
          [required]="true"
          [options]="operators"
          [value]="s.operator"
          [readonly]="readonly()"
          (valueChange)="setValue(service + '.operator', $event)"
        />
        @if (s.operator === 'provider') {
          <div class="grid gap-4 sm:grid-cols-2">
            <vm-legal-field
              [path]="'privacy.' + service + '.provider.name'"
              [required]="true"
              [value]="s.provider?.name ?? null"
              [error]="err(service + '/provider/name')"
              [readonly]="readonly()"
              (valueChange)="setProvider(service, 'name', $event)"
            />
            <vm-legal-field
              [path]="'privacy.' + service + '.provider.address'"
              [required]="true"
              [maxlength]="300"
              hintKey="system.settings.legal.hints.providerAddress"
              [value]="s.provider?.address ?? null"
              [error]="err(service + '/provider/address')"
              [readonly]="readonly()"
              (valueChange)="setProvider(service, 'address', $event)"
            />
          </div>
        }
        <label vm-field class="sm:w-72">
          <span vm-field-label>{{ 'system.settings.legal.fields.privacy.' + service + '.serverCountry' | transloco }} *</span>
          <select
            vm-select
            [disabled]="readonly()"
            [attr.aria-invalid]="err(service + '/serverCountry') ? 'true' : null"
            [value]="s.serverCountry ?? ''" (change)="setValue(service + '.serverCountry', $any($event.target).value || null)">
            <option value="">–</option>
            @for (c of countries; track c.code) {
              <option [value]="c.code">{{ c.name }}</option>
            }
          </select>
          @if (err(service + '/serverCountry'); as e) {
            <span vm-field-error>{{ 'validation.' + e | transloco }}</span>
          } @else {
            <span class="text-body-medium text-muted-foreground">{{ 'system.settings.legal.hints.serverCountry' | transloco }}</span>
          }
        </label>
        @if (service === 'hosting' && d.hosting.operator === 'provider') {
          <vm-legal-choice
            legendKey="system.settings.legal.fields.privacy.hosting.dpaConcluded"
            [required]="true"
            [options]="yesNo"
            [value]="d.hosting.dpaConcluded"
            [readonly]="readonly()"
            (valueChange)="setValue('hosting.dpaConcluded', $event)"
          />
          @if (d.hosting.dpaConcluded === false) {
            <p class="flex items-start gap-2 rounded-small bg-warning-soft p-3 text-body-medium text-warning-ink" role="status">
              <ng-icon name="lucideTriangleAlert" class="mt-0.5 shrink-0" aria-hidden="true" />{{ 'system.settings.legal.warnings.hosting-without-dpa' | transloco }}
            </p>
          }
        }
      </section>
    }

    <section class="flex flex-col gap-4" aria-labelledby="legal-retention">
      <h4 id="legal-retention" class="text-title-small">{{ 'system.settings.legal.groups.retention' | transloco }}</h4>
      <div class="grid gap-4 sm:grid-cols-2">
        <vm-legal-field
          path="privacy.serverLogRetentionDays"
          type="number"
          [required]="true"
          hintKey="system.settings.legal.hints.days"
          [value]="d.serverLogRetentionDays"
          [error]="err('serverLogRetentionDays')"
          [readonly]="readonly()"
          (valueChange)="setDays('serverLogRetentionDays', $event)"
        />
        <vm-legal-field
          path="privacy.backupRetentionDays"
          type="number"
          [required]="true"
          hintKey="system.settings.legal.hints.days"
          [value]="d.backupRetentionDays"
          [error]="err('backupRetentionDays')"
          [readonly]="readonly()"
          (valueChange)="setDays('backupRetentionDays', $event)"
        />
      </div>
    </section>

    <section class="flex flex-col gap-4" aria-labelledby="legal-authority">
      <h4 id="legal-authority" class="text-title-small">{{ 'system.settings.legal.groups.authority' | transloco }}</h4>
      <label vm-field class="sm:w-72">
        <span vm-field-label>{{ 'system.settings.legal.fields.privacy.state' | transloco }} *</span>
        <select vm-select [disabled]="readonly()" [value]="d.state ?? ''" (change)="setValue('state', $any($event.target).value || null)">
          <option value="">–</option>
          @for (s of states; track s) {
            <option [value]="s">{{ 'system.settings.legal.states.' + s | transloco }}</option>
          }
        </select>
        <span class="text-body-medium text-muted-foreground">{{ 'system.settings.legal.hints.state' | transloco }}</span>
      </label>
    </section>

    <vm-legal-field
      path="privacy.additionalText"
      [multiline]="true"
      [maxlength]="10000"
      hintKey="system.settings.legal.hints.additionalText"
      [value]="d.additionalText"
      [error]="err('additionalText')"
      [readonly]="readonly()"
      (valueChange)="setValue('additionalText', $event)"
    />
  `,
})
export class PrivacyDataForm {
  readonly data = input.required<PrivacyData>();
  /** Field errors keyed by path below `privacyData/`. */
  readonly errors = input<Record<string, string>>({});
  readonly readonly = input(false);
  /** Only the changed value, applied by the tab to its current state. */
  readonly fieldChange = output<FieldChange>();

  protected readonly services = ['hosting', 'identityServer'] as const;
  protected readonly operators = OPERATORS;
  protected readonly yesNo = YES_NO;
  protected readonly states = GERMAN_STATES;
  protected readonly countries = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) }));

  protected err(path: string): string | undefined {
    return this.errors()[`privacyData/${path}`];
  }

  protected setValue(path: string, value: unknown): void {
    this.fieldChange.emit({ path, value });
  }

  protected setProvider(service: 'hosting' | 'identityServer', key: 'name' | 'address', value: string): void {
    if (this.data()[service].provider) this.setValue(`${service}.provider.${key}`, value);
    else this.setValue(`${service}.provider`, { name: null, address: null, [key]: value });
  }

  /** Number input: empty → `null`, otherwise whole days. */
  protected setDays(key: 'serverLogRetentionDays' | 'backupRetentionDays', value: string): void {
    this.setValue(key, value.trim() === '' ? null : Math.trunc(Number(value)));
  }
}
