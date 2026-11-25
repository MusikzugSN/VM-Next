import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ImprintData } from '@vm-web/shared';

import { ToggleField } from '../../../../shared/ui/toggle-field';
import { LegalField } from './legal-field';
import { LegalPersonList } from './legal-person-list';
import { emptyPerson, type FieldChange } from './legal-model';

/**
 * Club data of the imprint (§ 5 DDG); also the controller of the privacy policy (S-7).
 * For a department of a parent club: department with its contact, then the parent club as provider.
 */
@Component({
  selector: 'vm-imprint-data-form',
  imports: [TranslocoPipe, ToggleField, LegalField, LegalPersonList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  templateUrl: './imprint-data-form.html',
})
export class ImprintDataForm {
  readonly data = input.required<ImprintData>();
  /** Field errors keyed by path below `imprintData/`. */
  readonly errors = input<Record<string, string>>({});
  readonly readonly = input(false);
  /** Only the changed value, applied by the tab to its current state (several changes may come at once, e.g. autofill). */
  readonly fieldChange = output<FieldChange>();

  protected err(path: string): string | undefined {
    return this.errors()[`imprintData/${path}`];
  }

  protected setValue(path: string, value: unknown): void {
    this.fieldChange.emit({ path, value });
  }

  protected toggleDepartment(on: boolean): void {
    this.setValue('department', on ? { name: '', email: '', phone: '', contacts: [emptyPerson()] } : null);
  }

  protected toggleResponsible(on: boolean): void {
    this.setValue('contentResponsible', on ? { name: '', address: { street: '', postalCode: '', city: '' } } : null);
  }
}
