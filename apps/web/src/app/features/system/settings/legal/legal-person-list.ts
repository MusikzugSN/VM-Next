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
  template: `
    <fieldset class="flex flex-col gap-3">
      <legend class="mb-1 font-medium">{{ legendKey() | transloco }}{{ required() ? ' *' : '' }}</legend>
      @if (hintKey(); as hint) {
        <p class="text-body-medium text-muted-foreground">{{ hint | transloco }}</p>
      }
      @for (p of persons(); track $index; let i = $index) {
        <div class="flex flex-col gap-3 rounded-small border p-3">
          <div class="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <vm-legal-field
              path="imprint.representativeName"
              [required]="true"
              [maxlength]="100"
              [value]="p.name"
              [error]="err(i, 'name')"
              [readonly]="readonly()"
              (valueChange)="set(i, 'name', $event)"
            />
            <vm-legal-field
              path="imprint.representativeRole"
              [required]="true"
              [maxlength]="100"
              [placeholder]="rolePlaceholderKey() | transloco"
              [value]="p.role"
              [error]="err(i, 'role')"
              [readonly]="readonly()"
              (valueChange)="set(i, 'role', $event)"
            />
            @if (!readonly()) {
              <button vm-icon-button type="button" [attr.aria-label]="'system.settings.legal.removePerson' | transloco: { index: i + 1 }" (click)="remove(i)">
                <ng-icon name="lucideTrash2" aria-hidden="true" />
              </button>
            }
          </div>
          <details class="group" [open]="hasAnyContact(p)">
            <summary class="flex min-h-target cursor-pointer items-center gap-2 text-body-medium font-medium">
              {{ 'system.settings.legal.personContact' | transloco }}
              @if (complete(p)) {
                <span class="inline-flex items-center gap-1 text-success-ink">
                  <ng-icon name="lucideCircleCheck" aria-hidden="true" />{{ 'system.settings.legal.contactComplete' | transloco }}
                </span>
              }
            </summary>
            <div class="mt-2 flex flex-col gap-3">
              <vm-legal-field
                path="imprint.address.street"
                autocomplete="off"
                [value]="p.address?.street ?? null"
                [error]="err(i, 'address/street')"
                [readonly]="readonly()"
                (valueChange)="setAddress(i, 'street', $event)"
              />
              <div class="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <vm-legal-field
                  path="imprint.address.postalCode"
                  [maxlength]="5"
                  [value]="p.address?.postalCode ?? null"
                  [error]="err(i, 'address/postalCode')"
                  [readonly]="readonly()"
                  (valueChange)="setAddress(i, 'postalCode', $event)"
                />
                <vm-legal-field
                  path="imprint.address.city"
                  [maxlength]="100"
                  [value]="p.address?.city ?? null"
                  [error]="err(i, 'address/city')"
                  [readonly]="readonly()"
                  (valueChange)="setAddress(i, 'city', $event)"
                />
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <vm-legal-field
                  path="imprint.phone"
                  type="tel"
                  [maxlength]="40"
                  [value]="p.phone"
                  [error]="err(i, 'phone')"
                  [readonly]="readonly()"
                  (valueChange)="set(i, 'phone', $event)"
                />
                <vm-legal-field
                  path="imprint.email"
                  type="email"
                  [value]="p.email"
                  [error]="err(i, 'email')"
                  [readonly]="readonly()"
                  (valueChange)="set(i, 'email', $event)"
                />
              </div>
            </div>
          </details>
        </div>
      }
      @if (!readonly() && persons().length < 10) {
        <button vm-button variant="outlined" type="button" class="self-start" (click)="add()">
          <ng-icon name="lucidePlus" aria-hidden="true" />{{ 'system.settings.legal.addPerson' | transloco }}
        </button>
      }
    </fieldset>
  `,
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
