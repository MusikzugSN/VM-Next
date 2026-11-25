import { ChangeDetectionStrategy, Component, computed, effect, input, model, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { customFieldTypeSchema, type CustomFieldType, type FieldDefinition } from '@vm-web/shared';
import { VmField, VmFieldLabel, VmInput, VmSelect, VmTextarea } from '@vm-web/ui';


import { FormDialog, runDialogSave } from '../../../shared/ui/form-dialog';
import { NAME_MAX } from '../../../shared/ui/name-dialog';
import { draftFromField, emptyDraft, optionsFromText, type FieldDraft } from './field-draft';
import { ToggleField } from '../../../shared/ui/toggle-field';

/** Body of create and update (`createFieldBodySchema`; `type` is ignored on update). */
export interface FieldDialogValue {
  name: string;
  type: CustomFieldType;
  required: boolean;
  options: { id?: string; label: string }[];
}

/**
 * Eigenes Feld anlegen oder bearbeiten (N-2), from the score form and from Konfiguration › Eigene Felder.
 * The type is fixed after creation; options keep their id while the label stays the same.
 */
@Component({
  selector: 'vm-field-dialog',
  imports: [VmField, VmFieldLabel, ToggleField, TranslocoPipe, VmInput, VmSelect, VmTextarea, FormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog renders in an overlay; its host must not take up space (or a gap) in the page.
  host: { style: 'display: contents' },
  templateUrl: './field-dialog.html',
})
export class FieldDialog {
  readonly open = model(false);
  /** Field being edited, `null` for a new one. */
  readonly field = input<FieldDefinition | null>(null);
  readonly save = input.required<(value: FieldDialogValue) => Promise<boolean>>();

  protected readonly max = NAME_MAX;
  protected readonly types = customFieldTypeSchema.options;
  protected readonly draft = signal<FieldDraft>(emptyDraft());
  protected readonly busy = signal(false);
  protected readonly needsOptions = computed(() => this.draft().type === 'select' || this.draft().type === 'multiselect');
  protected readonly valid = computed(() => !!this.draft().name.trim() && (!this.needsOptions() || optionsFromText(this.draft().options, []).length > 0));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const field = this.field();
      untracked(() => this.draft.set(field ? draftFromField(field) : emptyDraft()));
    });
  }

  protected patch(patch: Partial<FieldDraft>): void {
    this.draft.update((current) => ({ ...current, ...patch }));
  }

  protected submit(): void {
    if (!this.valid() || this.busy()) return;
    const d = this.draft();
    const options = this.needsOptions() ? optionsFromText(d.options, this.field()?.options ?? []) : [];
    void runDialogSave({ busy: this.busy, open: this.open }, () => this.save()({ name: d.name.trim(), type: d.type, required: d.required, options }));
  }
}
