import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowUp, lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { apiUrl, createdResponseSchema, customFieldTypeSchema, fieldDefinitionsResponseSchema, type CustomFieldType, type FieldDefinition } from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';
import { ZardTextareaComponent } from '@/shared/components/textarea';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { SessionStore } from '../../../core/auth/session.store';
import { NAME_MAX } from '../../../shared/ui/name-form';
import { PageProblem } from '../../../shared/ui/page-problem';
import { draftFromField, emptyDraft, optionsFromText, type FieldDraft } from './field-draft';

/** Tab „Eigene Felder“ (N-2, N-3): custom score fields in display order; type is fixed after creation. */
@Component({
  selector: 'vm-fields-settings',
  imports: [NgTemplateOutlet, NgIcon, TranslocoPipe, ZardButtonComponent, ZardInputComponent, ZardNativeSelectDirective, ZardTextareaComponent, PageProblem],
  viewProviders: [provideIcons({ lucideArrowUp, lucideArrowDown, lucidePencil, lucidePlus, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  template: `
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <p class="text-muted-foreground">{{ 'system.settings.fields.hint' | transloco }}</p>
      @if (canEdit() && editing() === null) {
        <button z-button type="button" class="w-full shrink-0 md:w-auto" (click)="startCreate()">
          <ng-icon name="lucidePlus" aria-hidden="true" />{{ 'system.settings.fields.create' | transloco }}
        </button>
      }
    </div>

    <ng-template #editor>
      <form class="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm" (submit)="$event.preventDefault(); save()" (keydown.escape)="editing.set(null)">
        <div class="flex flex-col gap-3 md:flex-row">
          <label class="flex flex-1 flex-col gap-1.5">
            <span class="font-medium">{{ 'system.common.name' | transloco }}</span>
            <input z-input type="text" required [maxLength]="nameMax" [value]="draft().name" (input)="patch({ name: $any($event.target).value })" />
          </label>
          <label class="flex flex-col gap-1.5 md:w-56">
            <span class="font-medium">{{ 'system.settings.fields.type' | transloco }}</span>
            <select z-native-select [disabled]="editing() !== 'new'" [value]="draft().type" (change)="patch({ type: $any($event.target).value })">
              @for (type of types; track type) {
                <option [value]="type" [selected]="type === draft().type">{{ 'terms.fieldTypes.' + type | transloco }}</option>
              }
            </select>
          </label>
        </div>
        @if (needsOptions()) {
          <label class="flex flex-col gap-1.5">
            <span class="font-medium">{{ 'system.settings.fields.options' | transloco }}</span>
            <textarea z-textarea rows="4" [value]="draft().options" (input)="patch({ options: $any($event.target).value })"></textarea>
            <span class="text-[13px] text-muted-foreground">{{ 'system.settings.fields.optionsHint' | transloco }}</span>
          </label>
        }
        <label class="flex items-center gap-2">
          <input type="checkbox" class="size-4 accent-primary" [checked]="draft().required" (change)="patch({ required: $any($event.target).checked })" />
          {{ 'system.settings.fields.required' | transloco }}
        </label>
        <div class="flex gap-2">
          <button z-button type="submit" [zDisabled]="!valid()">{{ (editing() === 'new' ? 'common.create' : 'common.save') | transloco }}</button>
          <button z-button zType="secondary" type="button" (click)="editing.set(null)">{{ 'common.cancel' | transloco }}</button>
        </div>
      </form>
    </ng-template>

    @if (editing() === 'new') {
      <ng-container [ngTemplateOutlet]="editor" />
    }

    @if (fields.error()) {
      <vm-page-problem [error]="fields.error()" />
    } @else if (items().length === 0 && fields.hasValue()) {
      <p class="rounded-lg border border-dashed p-8 text-center text-muted-foreground">{{ 'system.settings.fields.empty' | transloco }}</p>
    } @else {
      <ul class="overflow-hidden rounded-lg border bg-card shadow-sm">
        @for (field of items(); track field.id; let first = $first, last = $last, i = $index) {
          <li class="flex flex-col gap-2 px-3 py-2" [class.border-t]="!first">
            @if (editing() === field.id) {
              <ng-container [ngTemplateOutlet]="editor" />
            } @else {
              <div class="flex flex-col gap-2 md:flex-row md:items-center">
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
                    <button z-button zType="ghost" type="button" (click)="startEdit(field)" [attr.aria-label]="'system.settings.fields.editLabel' | transloco: { name: field.name }">
                      <ng-icon name="lucidePencil" aria-hidden="true" /><span class="hidden md:inline">{{ 'common.edit' | transloco }}</span>
                    </button>
                    <button z-button zType="ghost" type="button" class="text-destructive-ink" (click)="remove(field)" [attr.aria-label]="'system.settings.fields.deleteLabel' | transloco: { name: field.name }">
                      <ng-icon name="lucideTrash2" aria-hidden="true" /><span class="hidden md:inline">{{ 'common.delete' | transloco }}</span>
                    </button>
                  </span>
                }
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class FieldsSettings {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);

  protected readonly nameMax = NAME_MAX;
  protected readonly types = customFieldTypeSchema.options;
  protected readonly canEdit = computed(() => this.session.can('score.edit') || this.session.can('config.edit'));

  protected readonly fields = rxResource({
    stream: () => this.api.get(apiUrl('scores', 'fieldDefinitions'), fieldDefinitionsResponseSchema),
  });
  protected readonly items = computed(() => (this.fields.hasValue() ? this.fields.value().items : []));

  /** `'new'`, the id of the field being edited, or `null`. */
  protected readonly editing = signal<string | null>(null);
  protected readonly draft = signal<FieldDraft>(emptyDraft());
  protected readonly needsOptions = computed(() => this.draft().type === 'select' || this.draft().type === 'multiselect');
  protected readonly valid = computed(() => !!this.draft().name.trim() && (!this.needsOptions() || optionsFromText(this.draft().options, []).length > 0));

  protected optionLabels(field: FieldDefinition): string {
    return field.options.map((o) => o.label).join(', ');
  }

  protected patch(patch: Partial<FieldDraft>): void {
    this.draft.update((current) => ({ ...current, ...patch, type: (patch.type ?? current.type) as CustomFieldType }));
  }

  protected startCreate(): void {
    this.draft.set(emptyDraft());
    this.editing.set('new');
  }

  protected startEdit(field: FieldDefinition): void {
    this.draft.set(draftFromField(field));
    this.editing.set(field.id);
  }

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    const d = this.draft();
    const name = d.name.trim();
    const id = this.editing();
    const existing = this.items().find((f) => f.id === id)?.options ?? [];
    const options = this.needsOptions() ? optionsFromText(d.options, existing) : [];
    const done =
      id === 'new'
        ? await this.actions.run(
            () => firstValueFrom(this.api.post(apiUrl('scores', 'createField'), { name, type: d.type, required: d.required, options }, createdResponseSchema)),
            { success: { key: 'system.settings.fields.created', params: { name } } },
          )
        : await this.actions.run(
            () => firstValueFrom(this.api.postVoid(apiUrl('scores', 'updateField', { fieldId: id ?? '' }), { name, required: d.required, options })),
            { success: { key: 'system.settings.saved' } },
          );
    if (!done) return;
    this.editing.set(null);
    this.fields.reload();
  }

  protected async move(index: number, delta: -1 | 1): Promise<void> {
    const ids = this.items().map((f) => f.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('scores', 'reorderFields'), { fieldIds: ids })));
    if (done) this.fields.reload();
  }

  protected async remove(field: FieldDefinition): Promise<void> {
    if (!(await this.confirm.confirmDelete('system.settings.fields.deleteTitle', 'system.settings.fields.deleteText', { name: field.name }))) return;
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('scores', 'deleteField', { fieldId: field.id }))), {
      success: { key: 'system.settings.fields.deleted', params: { name: field.name } },
    });
    if (done) this.fields.reload();
  }
}
