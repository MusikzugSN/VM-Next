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
import { NAME_MAX } from '../../../shared/ui/name-dialog';
import { TreeLabelPipe } from '../../../shared/ui/tree-label.pipe';
import { ToggleField } from '../../../shared/ui/toggle-field';
import { selectOr } from '../../../core/util/resource-value';

/** Ensembles (S-2, F-3): the tree in pre-order, create below a parent, archive and restore. */
@Component({
  selector: 'vm-system-ensembles-page',
  imports: [VmSwitch, VmCard, VmField, VmFieldLabel, ToggleField, TreeLabelPipe, RouterLink, NgIcon, TranslocoPipe, PluralPipe, VmButton, VmInput, VmSelect, ListState, FormDialog],
  viewProviders: [provideIcons({ lucidePlus, lucideArchive, lucideArchiveRestore })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ensembles-page.html',
})
export class EnsemblesPage {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly session = inject(SessionStore);

  protected readonly nameMax = NAME_MAX;
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
