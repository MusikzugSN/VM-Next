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
  templateUrl: './privacy-data-form.html',
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
