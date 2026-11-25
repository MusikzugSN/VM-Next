import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { isCompleteContact, type LegalPerson } from '@vm-web/shared';

import { VmButton, VmIconButton } from '@vm-web/ui';

import { LegalField } from './legal-field';
import { emptyPerson, type FieldChange } from './legal-model';

/**
 * Persons of the imprint (S-7): board of the club (§ 26 BGB) or contact persons of a department.
 * Each with name and role, plus optional address, phone and e-mail. Complete contact data is marked.
 */
@Component({
  selector: 'vm-legal-person-list',
  imports: [TranslocoPipe, NgIcon, VmButton, VmIconButton, LegalField],
  viewProviders: [provideIcons({ lucideCircleCheck, lucidePlus, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './legal-person-list.html',
})
export class LegalPersonList {
  readonly persons = input.required<readonly LegalPerson[]>();
  /** Path of the list below `imprintData`, e.g. `representatives` or `department.contacts`. */
  readonly path = input.required<string>();
  readonly legendKey = input.required<string>();
  readonly hintKey = input<string | null>(null);
  readonly rolePlaceholderKey = input('system.settings.legal.hints.representativeRole');
  readonly required = input(false);
  /** Field errors keyed by path below `imprintData/`. */
  readonly errors = input<Record<string, string>>({});
  readonly readonly = input(false);
  readonly fieldChange = output<FieldChange>();

  protected readonly complete = isCompleteContact;

  protected hasAnyContact(p: LegalPerson): boolean {
    return !!(p.email || p.phone || p.address?.street || p.address?.postalCode || p.address?.city);
  }

  protected err(index: number, field: string): string | undefined {
    return this.errors()[`imprintData/${this.path().replace(/\./g, '/')}/${index}/${field}`];
  }

  protected set(index: number, field: 'name' | 'role' | 'email' | 'phone', value: string): void {
    this.fieldChange.emit({ path: `${this.path()}.${index}.${field}`, value });
  }

  protected setAddress(index: number, field: 'street' | 'postalCode' | 'city', value: string): void {
    const address = this.persons()[index].address;
    if (address) this.fieldChange.emit({ path: `${this.path()}.${index}.address.${field}`, value });
    else this.fieldChange.emit({ path: `${this.path()}.${index}.address`, value: { street: null, postalCode: null, city: null, [field]: value } });
  }

  protected add(): void {
    this.fieldChange.emit({ path: this.path(), value: [...this.persons(), emptyPerson()] });
  }

  protected remove(index: number): void {
    this.fieldChange.emit({ path: this.path(), value: this.persons().filter((_, i) => i !== index) });
  }
}
