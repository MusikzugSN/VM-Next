import { SHORT_NAME_MAX } from '@vm-web/shared';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArchive, lucideArchiveRestore, lucidePlus } from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  appPath,
  createdResponseSchema,
  ensembleListResponseSchema,
  userAssignmentOptionsResponseSchema,
  type EnsembleListItem,
} from '@vm-web/shared';

import { VmButton, VmCard, VmField, VmFieldLabel, VmInput, VmSelect, VmSwitch } from '@vm-web/ui';

import { ActionRunner } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { cursorList } from '../../../core/api/cursor-list';
import { SessionStore } from '../../../core/auth/session.store';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { ListState } from '../../../shared/ui/list-state';
import { FormDialog, runDialogSave } from '../../../shared/ui/form-dialog';
import { TreeLabelPipe } from '../../../shared/ui/tree-label.pipe';
import { ToggleField } from '../../../shared/ui/toggle-field';
import { selectOr } from '../../../core/util/resource-value';

/** Ensembles (S-2, F-3): the tree in pre-order, create below a parent, archive and restore. */
@Component({
  selector: 'vm-system-ensembles-page',
  imports: [VmSwitch, VmCard, VmField, VmFieldLabel, ToggleField, TreeLabelPipe, RouterLink, NgIcon, TranslocoPipe, PluralPipe, VmButton, VmInput, VmSelect, ListState, FormDialog],
  viewProviders: [provideIcons({ lucidePlus, lucideArchive, lucideArchiveRestore })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 class="text-headline-small">{{ 'nav.system.ensembles' | transloco }}</h1>
        <p class="mt-2 text-muted-foreground">{{ 'system.ensembles.intro' | transloco }}</p>
      </div>
      @if (canCreate()) {
        <button vm-button type="button" class="w-full md:w-auto" (click)="startCreate()">
          <ng-icon name="lucidePlus" aria-hidden="true" />{{ 'system.ensembles.create' | transloco }}
        </button>
      }
    </div>

    <vm-form-dialog
      [(open)]="creating"
      titleKey="system.ensembles.create"
      submitKey="common.create"
      [canSubmit]="!!newName().trim() && !!newParentId()"
      [busy]="busy()"
      (submitted)="create()"
    >
      <label vm-field>
        <span vm-field-label>{{ 'system.common.name' | transloco }} *</span>
        <input vm-input cdkFocusInitial type="text" [maxLength]="nameMax" [value]="newName()" (input)="newName.set($any($event.target).value)" required />
      </label>
      <label vm-field>
        <span vm-field-label>{{ 'system.ensembles.parent' | transloco }} *</span>
        <select vm-select [value]="newParentId()" (change)="newParentId.set($any($event.target).value)">
          @for (e of parents(); track e.id) {
            <option [value]="e.id" [selected]="e.id === newParentId()">{{ e | treeLabel }}</option>
          }
        </select>
      </label>
      <vm-toggle-field [label]="'system.ensembles.applyTemplate' | transloco" [hint]="'system.ensembles.applyTemplateHint' | transloco" [checked]="applyTemplate()" (toggled)="applyTemplate.set($event)" />
    </vm-form-dialog>

    <div class="flex items-center gap-1">
      <vm-switch [checked]="includeArchived()" [label]="'system.ensembles.showArchived' | transloco" (toggled)="includeArchived.set($event)" />
      <span aria-hidden="true">{{ 'system.ensembles.showArchived' | transloco }}</span>
    </div>

    <ul vm-card class="overflow-hidden" [class.hidden]="list.items().length === 0">
      @for (e of list.items(); track e.id; let first = $first) {
        <li class="flex items-start gap-2 px-4 py-3 md:items-center" [class.border-t]="!first" [class.bg-surface-container-low]="e.archived">
          <span class="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:gap-3" [style.padding-inline-start.rem]="e.depth * 1.25">
            <a [routerLink]="link(e)" class="font-medium">{{ e.name }}</a>
            <span class="flex flex-wrap gap-1.5 text-body-medium text-muted-foreground">
              @if (e.isRoot) {
                <span class="rounded-small bg-muted px-1.5 py-0.5 text-body-small">{{ 'system.ensembles.root' | transloco }}</span>
              }
              @if (e.isDefault) {
                <span class="rounded-small bg-primary-soft px-1.5 py-0.5 text-body-small text-primary">{{ 'system.ensembles.default' | transloco }}</span>
              }
              @if (e.archived) {
                <span class="rounded-small bg-muted px-1.5 py-0.5 text-body-small">{{ 'system.ensembles.archived' | transloco }}</span>
              }
              <span>{{ 'system.ensembles.memberCount' | tPlural: e.memberCount }} · {{ 'system.ensembles.lineupSize' | tPlural: e.lineupSize }}</span>
            </span>
          </span>
          @if (canEdit() && !e.isRoot) {
            @if (e.archived) {
              <button vm-button variant="text" type="button" (click)="setArchived(e, false)" [attr.aria-label]="'system.ensembles.unarchiveLabel' | transloco: { name: e.name }">
                <ng-icon name="lucideArchiveRestore" aria-hidden="true" /><span class="hidden md:inline">{{ 'system.ensembles.unarchive' | transloco }}</span>
              </button>
            } @else {
              <button vm-button variant="text" type="button" (click)="setArchived(e, true)" [attr.aria-label]="'system.ensembles.archiveLabel' | transloco: { name: e.name }">
                <ng-icon name="lucideArchive" aria-hidden="true" /><span class="hidden md:inline">{{ 'system.ensembles.archive' | transloco }}</span>
              </button>
            }
          }
        </li>
      }
    </ul>
    <vm-list-state [list]="list" emptyKey="system.ensembles.empty" />
  `,
})
export class EnsemblesPage {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly session = inject(SessionStore);

  protected readonly nameMax = SHORT_NAME_MAX;
  protected readonly canCreate = computed(() => this.session.can('ensemble.create'));
  protected readonly canEdit = computed(() => this.session.can('ensemble.edit'));
  protected readonly includeArchived = signal(false);
  protected readonly creating = signal(false);
  protected readonly newName = signal('');
  protected readonly newParentId = signal('');
  protected readonly applyTemplate = signal(true);
  protected readonly busy = signal(false);

  protected readonly list = cursorList({
    params: () => this.includeArchived(),
    fetch: (includeArchived, cursor) =>
      this.api.get(apiUrl('system', 'ensembleList'), ensembleListResponseSchema, { cursor, includeArchived: includeArchived ? 'true' : undefined }),
  });
  /** Active ensembles as possible parents. */
  private readonly options = rxResource({
    stream: () => this.api.get(apiUrl('system', 'userAssignmentOptions'), userAssignmentOptionsResponseSchema),
  });
  protected readonly parents = computed(() => selectOr(this.options, (v) => v.ensembles, []));

  protected link(e: EnsembleListItem): string {
    return appPath(APP_ROUTES.system.ensemble, { ensembleId: e.id });
  }

  protected startCreate(): void {
    this.newName.set('');
    this.newParentId.set(this.parents()[0]?.id ?? '');
    this.applyTemplate.set(true);
    this.creating.set(true);
  }

  protected create(): void {
    const name = this.newName().trim();
    if (!name || !this.newParentId() || this.busy()) return;
    void runDialogSave({ busy: this.busy, open: this.creating }, () => this.save(name));
  }

  private async save(name: string): Promise<boolean> {
    const done = await this.actions.runOnce(
      () =>
        this.api.post(apiUrl('system', 'createEnsemble'), { name, parentId: this.newParentId(), applyLineupTemplate: this.applyTemplate() }, createdResponseSchema),
      { success: { key: 'system.ensembles.created', params: { name } } },
    );
    if (done) this.changed();
    return !!done;
  }

  protected async setArchived(e: EnsembleListItem, archive: boolean): Promise<void> {
    const route = archive ? 'archiveEnsemble' : 'unarchiveEnsemble';
    const done = await this.actions.runOnce(() => this.api.postVoid(apiUrl('system', route, { ensembleId: e.id })), {
      success: { key: archive ? 'system.ensembles.archivedDone' : 'system.ensembles.unarchivedDone', params: { name: e.name } },
    });
    if (done) this.changed();
  }

  private changed(): void {
    this.list.reload();
    this.options.reload();
    void this.session.reload();
  }
}
