import { SHORT_NAME_MAX } from '@vm-web/shared';
import { ChangeDetectionStrategy, Component, computed, effect, input, model, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Ref } from '@vm-web/shared';
import { VmField, VmFieldLabel, VmInput, VmSelect } from '@vm-web/ui';


import { FormDialog, runDialogSave } from '../../../shared/ui/form-dialog';
import { TreeLabelPipe } from '../../../shared/ui/tree-label.pipe';
import { ToggleField } from '../../../shared/ui/toggle-field';

export interface CreateInEnsemble {
  ensembleId: string;
  name: string;
  show: boolean;
  /** Events only. */
  date: string;
}

/** Dialog „Mappe anlegen“ / „Event anlegen“ in one of the allowed ensembles (N-15). */
@Component({
  selector: 'vm-create-in-ensemble-dialog',
  imports: [VmField, VmFieldLabel, ToggleField, TreeLabelPipe, TranslocoPipe, VmInput, VmSelect, FormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog renders in an overlay; its host must not take up space (or a gap) in the page.
  host: { style: 'display: contents' },
  template: `
    <vm-form-dialog [(open)]="open" [titleKey]="titleKey()" submitKey="common.create" [canSubmit]="valid()" [busy]="busy()" (submitted)="submit()">
      <label vm-field>
        <span vm-field-label>{{ 'library.common.name' | transloco }} *</span>
        <input vm-input cdkFocusInitial type="text" [maxLength]="max" [value]="name()" (input)="name.set($any($event.target).value)" />
      </label>
      @if (withDate()) {
        <label vm-field>
          <span vm-field-label>{{ 'library.events.date' | transloco }} *</span>
          <input vm-input type="date" [value]="date()" (input)="date.set($any($event.target).value)" />
        </label>
      }
      <label vm-field>
          <span vm-field-label>{{ 'terms.ensemble' | transloco }} *</span>
          <select vm-select [value]="ensembleId()" (change)="ensembleId.set($any($event.target).value)">
            @for (ensemble of ensembles(); track ensemble.id) {
              <option [value]="ensemble.id" [selected]="ensemble.id === ensembleId()">{{ ensemble | treeLabel }}</option>
            }
          </select>
        </label>
      <vm-toggle-field [label]="'library.common.showInMyArea' | transloco" [hint]="'library.common.showInMyAreaHint' | transloco" [checked]="show()" (toggled)="show.set($event)" />
    </vm-form-dialog>
  `,
})
export class CreateInEnsembleDialog {
  readonly open = model(false);
  readonly titleKey = input.required<string>();
  readonly ensembles = input.required<readonly Ref[]>();
  readonly withDate = input(false);
  readonly save = input.required<(value: CreateInEnsemble) => Promise<boolean>>();

  protected readonly max = SHORT_NAME_MAX;
  protected readonly name = signal('');
  protected readonly date = signal('');
  protected readonly ensembleId = signal('');
  protected readonly show = signal(false);
  protected readonly busy = signal(false);
  protected readonly valid = computed(() => !!this.name().trim() && !!this.ensembleId() && (!this.withDate() || !!this.date()));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.name.set('');
        this.date.set('');
        this.show.set(false);
        this.ensembleId.set(this.ensembles()[0]?.id ?? '');
      });
    });
  }

  protected submit(): void {
    if (!this.valid() || this.busy()) return;
    const value = { ensembleId: this.ensembleId(), name: this.name().trim(), show: this.show(), date: this.date() };
    void runDialogSave({ busy: this.busy, open: this.open }, () => this.save()(value));
  }
}
