import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { apiUrl, createdResponseSchema, type FieldDefinition } from '@vm-web/shared';

import { VmButton, VmCard, VmCheckbox, VmField, VmFieldError, VmFieldLabel, VmInput, VmSelect } from '@vm-web/ui';

import { ActionRunner } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { LibraryOptions } from '../library-options';
import { FieldDialog, type FieldDialogValue } from '../ui/field-dialog';
import type { ScoreFormErrors, ScoreFormInput } from './score-form-model';

/**
 * Fields of a score (N-1, N-2, N-17): fixed fields, club tags, custom fields by type and
 * „Feld hinzufügen“. The parent owns the value (`[(value)]`) and the errors.
 */
@Component({
  selector: 'vm-score-form',
  imports: [VmCheckbox, VmCard, VmField, VmFieldLabel, VmFieldError, NgIcon, TranslocoPipe, VmButton, VmInput, VmSelect, FieldDialog],
  viewProviders: [provideIcons({ lucidePlus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './score-form.html',
})
export class ScoreForm {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  protected readonly options = inject(LibraryOptions);

  readonly value = model.required<ScoreFormInput>();
  readonly errors = input<ScoreFormErrors>({});
  readonly readonly = input(false);

  protected readonly fixed = [
    { key: 'composer', labelKey: 'library.fields.composer' },
    { key: 'arranger', labelKey: 'library.fields.arranger' },
    { key: 'publisher', labelKey: 'library.fields.publisher' },
    { key: 'publisherNumber', labelKey: 'library.fields.publisherNumber' },
  ] as const;

  protected readonly addingField = signal(false);

  protected set<K extends keyof ScoreFormInput>(key: K, value: ScoreFormInput[K]): void {
    this.value.update((current) => ({ ...current, [key]: value }));
  }

  protected setCustom(field: FieldDefinition, value: string | string[] | boolean): void {
    this.value.update((current) => ({ ...current, custom: { ...current.custom, [field.id]: value } }));
  }

  protected custom(field: FieldDefinition): string | string[] | boolean | undefined {
    return this.value().custom[field.id];
  }

  protected toggleTag(id: string, checked: boolean): void {
    const ids = this.value().tagIds;
    this.set('tagIds', checked ? [...ids, id] : ids.filter((x) => x !== id));
  }

  protected toggleOption(field: FieldDefinition, id: string, checked: boolean): void {
    const current = this.custom(field);
    const ids = Array.isArray(current) ? current : [];
    this.setCustom(field, checked ? [...ids, id] : ids.filter((x) => x !== id));
  }

  protected hasOption(field: FieldDefinition, id: string): boolean {
    const current = this.custom(field);
    return Array.isArray(current) && current.includes(id);
  }

  protected error(key: string): string | null {
    return this.errors()[key] ?? null;
  }

  /** „Feld hinzufügen“ (N-2): creates the custom field for all scores right from the form. */
  protected readonly createField = async (value: FieldDialogValue): Promise<boolean> => {
    const done = await this.actions.runOnce(() => this.api.post(apiUrl('scores', 'createField'), value, createdResponseSchema), {
      success: { key: 'library.form.fieldCreated', params: { name: value.name } },
    });
    if (done) this.options.reloadFields();
    return !!done;
  };
}
