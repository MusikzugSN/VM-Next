import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLock, lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { APP_ROUTES, apiUrl, clubTagListResponseSchema, createdResponseSchema, type ClubTagItem } from '@vm-web/shared';

import { VmButton, VmCard } from '@vm-web/ui';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { cursorList } from '../../../core/api/cursor-list';
import { SessionStore } from '../../../core/auth/session.store';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { debounced } from '../../../core/util/debounced';
import { ListState } from '../../../shared/ui/list-state';
import { NameDialog } from '../../../shared/ui/name-dialog';
import { SearchField } from '../../../shared/ui/search-field';
import { LibraryOptions } from '../library-options';

/** Vereins-Tags (N-17): create, rename, delete; personal tags live in Mein Bereich. */
@Component({
  selector: 'vm-library-club-tags-page',
  imports: [VmCard, RouterLink, NgIcon, TranslocoPipe, PluralPipe, VmButton, ListState, NameDialog, SearchField],
  viewProviders: [provideIcons({ lucidePlus, lucidePencil, lucideTrash2, lucideLock })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './club-tags-page.html',
})
export class ClubTagsPage {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);
  private readonly options = inject(LibraryOptions);

  protected readonly meTagsPath = APP_ROUTES.me.tags;
  protected readonly canCreate = computed(() => this.session.can('tag.create'));
  protected readonly canEdit = computed(() => this.session.can('tag.edit'));
  protected readonly canDelete = computed(() => this.session.can('tag.delete'));
  protected readonly creating = signal(false);
  protected readonly renaming = signal<ClubTagItem | null>(null);
  protected readonly renameOpen = signal(false);
  protected readonly search = signal('');
  private readonly query = debounced(this.search);

  protected readonly list = cursorList({
    params: () => this.query().trim(),
    fetch: (q, cursor) => this.api.get(apiUrl('tags', 'clubTagList'), clubTagListResponseSchema, { cursor, q }),
  });

  protected startRename(tag: ClubTagItem): void {
    this.renaming.set(tag);
    this.renameOpen.set(true);
  }

  protected readonly create = async (name: string): Promise<boolean> => {
    const done = await this.actions.runOnce(() => this.api.post(apiUrl('tags', 'createTag'), { name }, createdResponseSchema), {
      success: { key: 'library.tags.created', params: { name } },
    });
    if (done) this.changed();
    return !!done;
  };

  protected readonly rename = async (name: string): Promise<boolean> => {
    const tag = this.renaming();
    if (!tag) return false;
    const done = await this.actions.runOnce(() => this.api.postVoid(apiUrl('tags', 'renameTag', { tagId: tag.id }), { name }));
    if (done) this.changed();
    return !!done;
  };

  protected async remove(tag: ClubTagItem): Promise<void> {
    const done = await this.confirm.confirmedDelete('library.tags.deleteTitle', 'library.tags.deleteText', { name: tag.name, count: tag.scoreCount }, () => this.api.postVoid(apiUrl('tags', 'deleteTag', { tagId: tag.id })), {
      success: { key: 'library.tags.deleted', params: { name: tag.name } },
    });
    if (done) this.changed();
  }

  private changed(): void {
    this.list.reload();
    this.options.reloadTags();
  }
}
