import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  appPath,
  createdResponseSchema,
  ensembleOptionsResponseSchema,
  folderListResponseSchema,
  type FolderListItem,
} from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { cursorList } from '../../../core/api/cursor-list';
import { SessionStore } from '../../../core/auth/session.store';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { ViewportService } from '../../../core/layout/viewport';
import { debounced } from '../../../core/util/debounced';
import { ListState } from '../../../shared/ui/list-state';
import { SearchField } from '../../../shared/ui/search-field';
import { ToggleSwitch } from '../../../shared/ui/toggle-switch';
import { CreateInEnsembleForm, type CreateInEnsemble } from '../ui/create-in-ensemble-form';

/** Mappen verwalten (N-15): folders per ensemble, visibility in Mein Bereich, create and delete. */
@Component({
  selector: 'vm-library-manage-folders-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    PluralPipe,
    ZardButtonComponent,
    ZardNativeSelectDirective,
    ListState,
    SearchField,
    ToggleSwitch,
    CreateInEnsembleForm,
  ],
  viewProviders: [provideIcons({ lucidePlus, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './manage-folders-page.html',
})
export class ManageFoldersPage {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  protected readonly viewport = inject(ViewportService);

  protected readonly ensembleId = signal('');
  protected readonly search = signal('');
  private readonly query = debounced(this.search);
  protected readonly creating = signal(false);

  /** Ensembles in which folders may be created. */
  protected readonly createOptions = rxResource({
    stream: () => this.api.get(apiUrl('folders', 'ensembleOptions'), ensembleOptionsResponseSchema),
  });
  protected readonly canCreate = computed(() => this.createOptions.hasValue() && this.createOptions.value().items.length > 0);
  /** Ensembles for the filter: those the person is member of with folder.view (from the session). */
  protected readonly filterOptions = computed(() =>
    (this.session.access()?.permissions.ensembles ?? []).filter((e) => this.session.can('folder.view', e.ensemble.id)).map((e) => e.ensemble),
  );

  protected readonly list = cursorList({
    params: () => ({ ensembleId: this.ensembleId() || undefined, q: this.query().trim() || undefined }),
    fetch: (p, cursor) => this.api.get(apiUrl('folders', 'folderList'), folderListResponseSchema, { ...p, cursor }),
  });

  protected link(folder: FolderListItem): string {
    return appPath(APP_ROUTES.library.folder, { folderId: folder.id });
  }

  protected canEdit(folder: FolderListItem): boolean {
    return this.session.can('folder.edit', folder.ensemble.id);
  }

  protected canDelete(folder: FolderListItem): boolean {
    return this.session.can('folder.delete', folder.ensemble.id);
  }

  protected visibilityLabel(folder: FolderListItem): string {
    return this.transloco.translate('library.folders.showLabel', { name: folder.name });
  }

  protected async create(input: CreateInEnsemble): Promise<void> {
    const done = await this.actions.run(
      () =>
        firstValueFrom(
          this.api.post(apiUrl('folders', 'createFolder'), { ensembleId: input.ensembleId, name: input.name, showInMyArea: input.show }, createdResponseSchema),
        ),
      { success: { key: 'library.folders.created', params: { name: input.name } } },
    );
    if (done) void this.router.navigateByUrl(appPath(APP_ROUTES.library.folder, { folderId: done.value.id }));
  }

  protected async setVisibility(folder: FolderListItem, show: boolean): Promise<void> {
    const done = await this.actions.run(
      () => firstValueFrom(this.api.postVoid(apiUrl('folders', 'setVisibility', { folderId: folder.id }), { showInMyArea: show })),
      { success: { key: show ? 'library.folders.shown' : 'library.folders.hidden', params: { name: folder.name } } },
    );
    if (done) this.list.reload();
  }

  protected async remove(folder: FolderListItem): Promise<void> {
    if (!(await this.confirm.confirmDelete('library.folders.deleteTitle', 'library.folders.deleteText', { name: folder.name }))) return;
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('folders', 'deleteFolder', { folderId: folder.id }))), {
      success: { key: 'library.folders.deleted', params: { name: folder.name } },
    });
    if (done) this.list.reload();
  }
}
