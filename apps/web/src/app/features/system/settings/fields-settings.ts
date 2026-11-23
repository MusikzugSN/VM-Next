import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowUp, lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { apiUrl, createdResponseSchema, fieldDefinitionsResponseSchema, type FieldDefinition } from '@vm-web/shared';

import { ZardButtonComponent } from '@/shared/components/button';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { SessionStore } from '../../../core/auth/session.store';
import { PageProblem } from '../../../shared/ui/page-problem';
import { FieldDialog, type FieldDialogValue } from '../../library/ui/field-dialog';
import { selectOr } from '../../../core/util/resource-value';

/** Tab „Eigene Felder“ (N-2, N-3): custom score fields in display order; create and edit in a dialog. */
@Component({
  selector: 'vm-fields-settings',
  imports: [NgIcon, TranslocoPipe, ZardButtonComponent, PageProblem, FieldDialog],
  viewProviders: [provideIcons({ lucideArrowUp, lucideArrowDown, lucidePencil, lucidePlus, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  template: `
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <p class="text-muted-foreground">{{ 'system.settings.fields.hint' | transloco }}</p>
      @if (canEdit()) {
        <button z-button type="button" class="w-full shrink-0 md:w-auto" (click)="openDialog(null)">
          <ng-icon name="lucidePlus" aria-hidden="true" />{{ 'fields.create' | transloco }}
        </button>
      }
    </div>

    @if (fields.error()) {
      <vm-page-problem [error]="fields.error()" />
    } @else if (items().length === 0 && fields.hasValue()) {
      <p class="rounded-lg border border-dashed p-8 text-center text-muted-foreground">{{ 'system.settings.fields.empty' | transloco }}</p>
    } @else {
      <ul class="overflow-hidden rounded-lg border bg-card shadow-sm">
        @for (field of items(); track field.id; let first = $first, last = $last, i = $index) {
          <li class="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center" [class.border-t]="!first">
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="font-medium">{{ field.name }}{{ field.required ? ' *' : '' }}</span>
              <span class="text-[13px] text-muted-foreground">
                {{ 'terms.fieldTypes.' + field.type | transloco }}
                @if (field.options.length) {
                  · {{ optionLabels(field) }}
                }
              </span>
            </span>
            @if (canEdit()) {
              <span class="flex gap-1">
                <button z-button zType="ghost" zSize="icon" type="button" [zDisabled]="first" (click)="move(i, -1)" [attr.aria-label]="'common.moveUp' | transloco: { name: field.name }">
                  <ng-icon name="lucideArrowUp" aria-hidden="true" />
                </button>
                <button z-button zType="ghost" zSize="icon" type="button" [zDisabled]="last" (click)="move(i, 1)" [attr.aria-label]="'common.moveDown' | transloco: { name: field.name }">
                  <ng-icon name="lucideArrowDown" aria-hidden="true" />
                </button>
                <button z-button zType="ghost" type="button" (click)="openDialog(field)" [attr.aria-label]="'system.settings.fields.editLabel' | transloco: { name: field.name }">
                  <ng-icon name="lucidePencil" aria-hidden="true" /><span class="hidden md:inline">{{ 'common.edit' | transloco }}</span>
                </button>
                <button z-button zType="ghost" type="button" class="text-destructive-ink" (click)="remove(field)" [attr.aria-label]="'system.settings.fields.deleteLabel' | transloco: { name: field.name }">
                  <ng-icon name="lucideTrash2" aria-hidden="true" /><span class="hidden md:inline">{{ 'common.delete' | transloco }}</span>
                </button>
              </span>
            }
          </li>
        }
      </ul>
    }

    <vm-field-dialog [(open)]="dialogOpen" [field]="editing()" [save]="save" />
  `,
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
    const ids = this.items().map((f) => f.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const done = await this.actions.runOnce(() => this.api.postVoid(apiUrl('scores', 'reorderFields'), { fieldIds: ids }));
    if (done) this.fields.reload();
  }

  protected async remove(field: FieldDefinition): Promise<void> {
    if (!(await this.confirm.confirmDelete('system.settings.fields.deleteTitle', 'system.settings.fields.deleteText', { name: field.name }))) return;
    const done = await this.actions.runOnce(() => this.api.postVoid(apiUrl('scores', 'deleteField', { fieldId: field.id })), {
      success: { key: 'system.settings.fields.deleted', params: { name: field.name } },
    });
    if (done) this.fields.reload();
  }
}
