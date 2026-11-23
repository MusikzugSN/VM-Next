import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Ref } from '@vm-web/shared';

import { ZardInputComponent } from '@/shared/components/input';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';

import { FormDialog, runDialogSave } from '../../../shared/ui/form-dialog';
import { NAME_MAX } from '../../../shared/ui/name-dialog';
import { TreeLabelPipe } from '../../../shared/ui/tree-label.pipe';
import { ToggleField } from '../../../shared/ui/toggle-field';
import { onOpened } from '../../../core/util/on-opened';

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
  imports: [ToggleField, TreeLabelPipe, TranslocoPipe, ZardInputComponent, ZardNativeSelectDirective, FormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog renders in an overlay; its host must not take up space (or a gap) in the page.
  host: { style: 'display: contents' },
  template: `
    <vm-form-dialog [(open)]="open" [titleKey]="titleKey()" submitKey="common.create" [canSubmit]="valid()" [busy]="busy()" (submitted)="submit()">
      <label class="flex flex-col gap-1.5">
        <span class="font-medium">{{ 'library.common.name' | transloco }} *</span>
        <input z-input cdkFocusInitial type="text" [maxLength]="max" [value]="name()" (input)="name.set($any($event.target).value)" />
      </label>
      @if (withDate()) {
        <label class="flex flex-col gap-1.5">
          <span class="font-medium">{{ 'library.events.date' | transloco }} *</span>
          <input z-input type="date" [value]="date()" (input)="date.set($any($event.target).value)" />
        </label>
      }
      <label class="flex flex-col gap-1.5">
          <span class="font-medium">{{ 'terms.ensemble' | transloco }} *</span>
          <select z-native-select [value]="ensembleId()" (change)="ensembleId.set($any($event.target).value)">
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

  protected readonly max = NAME_MAX;
  protected readonly name = signal('');
  protected readonly date = signal('');
  protected readonly ensembleId = signal('');
  protected readonly show = signal(false);
  protected readonly busy = signal(false);
  protected readonly valid = computed(() => !!this.name().trim() && !!this.ensembleId() && (!this.withDate() || !!this.date()));

  constructor() {
    onOpened(this.open, () => {
      this.name.set('');
      this.date.set('');
      this.show.set(false);
      this.ensembleId.set(this.ensembles()[0]?.id ?? '');
    });
  }

  protected submit(): void {
    if (!this.valid() || this.busy()) return;
    const value = { ensembleId: this.ensembleId(), name: this.name().trim(), show: this.show(), date: this.date() };
    void runDialogSave({ busy: this.busy, open: this.open }, () => this.save()(value));
  }
}
