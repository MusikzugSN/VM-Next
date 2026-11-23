import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLock, lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { APP_ROUTES, apiUrl, clubTagListResponseSchema, createdResponseSchema, type ClubTagItem } from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';

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
  imports: [RouterLink, NgIcon, TranslocoPipe, PluralPipe, ZardButtonComponent, ListState, NameDialog, SearchField],
  viewProviders: [provideIcons({ lucidePlus, lucidePencil, lucideTrash2, lucideLock })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ 'nav.library.tags' | transloco }}</h1>
        <p class="mt-2 text-muted-foreground">{{ 'library.tags.intro' | transloco }}</p>
      </div>
      @if (canCreate()) {
        <button z-button type="button" class="w-full md:w-auto" (click)="creating.set(true)">
          <ng-icon name="lucidePlus" aria-hidden="true" />{{ 'library.tags.create' | transloco }}
        </button>
      }
    </div>

    <vm-name-dialog [(open)]="creating" titleKey="library.tags.create" labelKey="library.tags.newTag" [save]="create" />
    <vm-name-dialog
      [(open)]="renameOpen"
      titleKey="common.rename"
      labelKey="library.tags.name"
      submitKey="common.save"
      [initial]="renaming()?.name ?? ''"
      [save]="rename"
    />

    <vm-search-field [(value)]="search" labelKey="library.tags.search" />

    <ul class="overflow-hidden rounded-lg border bg-card shadow-sm" [class.hidden]="list.items().length === 0">
      @for (tag of list.items(); track tag.id; let first = $first) {
        <li class="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center" [class.border-t]="!first">
            <span class="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:gap-3">
              <span class="text-base font-medium md:text-sm">{{ tag.name }}</span>
              <span class="text-[13px] text-muted-foreground">{{ 'library.tags.scoreCount' | tPlural: tag.scoreCount }}</span>
            </span>
            <span class="flex gap-1">
              @if (canEdit()) {
                <button z-button zType="ghost" type="button" (click)="startRename(tag)" [attr.aria-label]="'library.tags.renameLabel' | transloco: { name: tag.name }">
                  <ng-icon name="lucidePencil" aria-hidden="true" /><span class="hidden md:inline">{{ 'common.rename' | transloco }}</span>
                </button>
              }
              @if (canDelete()) {
                <button z-button zType="ghost" type="button" class="text-destructive-ink" (click)="remove(tag)" [attr.aria-label]="'library.tags.deleteLabel' | transloco: { name: tag.name }">
                  <ng-icon name="lucideTrash2" aria-hidden="true" /><span class="hidden md:inline">{{ 'common.delete' | transloco }}</span>
                </button>
              }
            </span>
        </li>
      }
    </ul>
    <vm-list-state [list]="list" emptyKey="library.tags.empty" />

    <aside class="flex items-start gap-2 rounded-lg border p-4 text-[13px] text-muted-foreground">
      <ng-icon name="lucideLock" class="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{{ 'library.tags.personalHint' | transloco }} <a [routerLink]="meTagsPath" class="font-medium">{{ 'library.tags.personalLink' | transloco }}</a></span>
    </aside>
  `,
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
    const done = await this.actions.run(() => firstValueFrom(this.api.post(apiUrl('tags', 'createTag'), { name }, createdResponseSchema)), {
      success: { key: 'library.tags.created', params: { name } },
    });
    if (done) this.changed();
    return !!done;
  };

  protected readonly rename = async (name: string): Promise<boolean> => {
    const tag = this.renaming();
    if (!tag) return false;
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('tags', 'renameTag', { tagId: tag.id }), { name })));
    if (done) this.changed();
    return !!done;
  };

  protected async remove(tag: ClubTagItem): Promise<void> {
    const done = await this.confirm.confirmedDelete('library.tags.deleteTitle', 'library.tags.deleteText', { name: tag.name, count: tag.scoreCount }, () => firstValueFrom(this.api.postVoid(apiUrl('tags', 'deleteTag', { tagId: tag.id }))), {
      success: { key: 'library.tags.deleted', params: { name: tag.name } },
    });
    if (done) this.changed();
  }

  private changed(): void {
    this.list.reload();
    this.options.reloadTags();
  }
}
