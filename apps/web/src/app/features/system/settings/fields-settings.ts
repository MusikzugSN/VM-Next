import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowUp, lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { apiUrl, createdResponseSchema, fieldDefinitionsResponseSchema, type FieldDefinition } from '@vm-web/shared';

import { VmButton, VmCard, VmIconButton } from '@vm-web/ui';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { SessionStore } from '../../../core/auth/session.store';
import { PageProblem } from '../../../shared/ui/page-problem';
import { FieldDialog, type FieldDialogValue } from '../../library/ui/field-dialog';
import { moveItem } from '../../../core/util/move-item';
import { selectOr } from '../../../core/util/resource-value';

/** Tab „Eigene Felder“ (N-2, N-3): custom score fields in display order; create and edit in a dialog. */
@Component({
  selector: 'vm-fields-settings',
  imports: [VmCard, NgIcon, TranslocoPipe, VmButton, VmIconButton, PageProblem, FieldDialog],
  viewProviders: [provideIcons({ lucideArrowUp, lucideArrowDown, lucidePencil, lucidePlus, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  templateUrl: './fields-settings.html',
})
export class FieldsSettings {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);

  protected readonly canEdit = computed(() => this.session.can('score.edit') || this.session.can('config.edit'));

  protected readonly fields = rxResource({
    stream: () => this.api.get(apiUrl('scores', 'fieldDefinitions'), fieldDefinitionsResponseSchema),
  });
  protected readonly items = computed(() => selectOr(this.fields, (v) => v.items, []));

  protected readonly dialogOpen = signal(false);
  /** Field in the dialog, `null` for a new one. */
  protected readonly editing = signal<FieldDefinition | null>(null);

  protected optionLabels(field: FieldDefinition): string {
    return field.options.map((o) => o.label).join(', ');
  }

  protected openDialog(field: FieldDefinition | null): void {
    this.editing.set(field);
    this.dialogOpen.set(true);
  }

  protected readonly save = async (value: FieldDialogValue): Promise<boolean> => {
    const field = this.editing();
    const done = field
      ? await this.actions.runOnce(
          () =>
            this.api.postVoid(apiUrl('scores', 'updateField', { fieldId: field.id }), { name: value.name, required: value.required, options: value.options }),
          { success: { key: 'system.settings.saved' } },
        )
      : await this.actions.runOnce(() => this.api.post(apiUrl('scores', 'createField'), value, createdResponseSchema), {
          success: { key: 'system.settings.fields.created', params: { name: value.name } },
        });
    if (done) this.fields.reload();
    return !!done;
  };

  protected async move(index: number, delta: -1 | 1): Promise<void> {
    const current = this.items().map((f) => f.id);
    const target = index + delta;
    if (target < 0 || target >= current.length) return; // at the edge nothing is sent
    const ids = moveItem(current, index, delta);
    const done = await this.actions.runOnce(() => this.api.postVoid(apiUrl('scores', 'reorderFields'), { fieldIds: ids }));
    if (done) this.fields.reload();
  }

  protected async remove(field: FieldDefinition): Promise<void> {
    const done = await this.confirm.confirmedDelete('system.settings.fields.deleteTitle', 'system.settings.fields.deleteText', { name: field.name }, () => this.api.postVoid(apiUrl('scores', 'deleteField', { fieldId: field.id })), {
      success: { key: 'system.settings.fields.deleted', params: { name: field.name } },
    });
    if (done) this.fields.reload();
  }
}
