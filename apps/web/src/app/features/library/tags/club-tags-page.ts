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
import { NameForm } from '../../../shared/ui/name-form';
import { SearchField } from '../../../shared/ui/search-field';
import { LibraryOptions } from '../library-options';

/** Vereins-Tags (N-17): create, rename, delete; personal tags live in Mein Bereich. */
@Component({
  selector: 'vm-library-club-tags-page',
  imports: [RouterLink, NgIcon, TranslocoPipe, PluralPipe, ZardButtonComponent, ListState, NameForm, SearchField],
  viewProviders: [provideIcons({ lucidePlus, lucidePencil, lucideTrash2, lucideLock })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ 'nav.library.tags' | transloco }}</h1>
        <p class="mt-1 text-muted-foreground">{{ 'library.tags.intro' | transloco }}</p>
      </div>
      @if (canCreate() && !creating()) {
        <button z-button type="button" class="w-full md:w-auto" (click)="creating.set(true)">
          <ng-icon name="lucidePlus" aria-hidden="true" />{{ 'library.tags.create' | transloco }}
        </button>
      }
    </div>

    @if (creating()) {
      <vm-name-form labelKey="library.tags.newTag" (saved)="create($event)" (cancelled)="creating.set(false)" />
    }

    <vm-search-field [(value)]="search" labelKey="library.tags.search" />

    <ul class="overflow-hidden rounded-lg border bg-card shadow-sm" [class.hidden]="list.items().length === 0">
      @for (tag of list.items(); track tag.id; let first = $first) {
        <li class="flex flex-col gap-2 px-3 py-2 md:flex-row md:items-center" [class.border-t]="!first">
          @if (renaming() === tag.id) {
            <vm-name-form class="flex-1" labelKey="library.tags.name" submitKey="common.save" [initial]="tag.name" (saved)="rename(tag, $event)" (cancelled)="renaming.set(null)" />
          } @else {
            <span class="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:gap-3">
              <span class="text-base font-medium md:text-sm">{{ tag.name }}</span>
              <span class="text-[13px] text-muted-foreground">{{ 'library.tags.scoreCount' | tPlural: tag.scoreCount }}</span>
            </span>
            <span class="flex gap-1">
              @if (canEdit()) {
                <button z-button zType="ghost" type="button" (click)="renaming.set(tag.id)" [attr.aria-label]="'library.tags.renameLabel' | transloco: { name: tag.name }">
                  <ng-icon name="lucidePencil" aria-hidden="true" /><span class="hidden md:inline">{{ 'common.rename' | transloco }}</span>
                </button>
              }
              @if (canDelete()) {
                <button z-button zType="ghost" type="button" class="text-destructive-ink" (click)="remove(tag)" [attr.aria-label]="'library.tags.deleteLabel' | transloco: { name: tag.name }">
                  <ng-icon name="lucideTrash2" aria-hidden="true" /><span class="hidden md:inline">{{ 'common.delete' | transloco }}</span>
                </button>
              }
            </span>
          }
        </li>
      }
    </ul>
    <vm-list-state [list]="list" emptyKey="library.tags.empty" />

    <aside class="flex items-start gap-2 rounded-lg border p-3 text-[13px] text-muted-foreground">
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
  protected readonly renaming = signal<string | null>(null);
  protected readonly search = signal('');
  private readonly query = debounced(this.search);

  protected readonly list = cursorList({
    params: () => this.query().trim(),
    fetch: (q, cursor) => this.api.get(apiUrl('tags', 'clubTagList'), clubTagListResponseSchema, { cursor, q }),
  });

  protected async create(name: string): Promise<void> {
    const done = await this.actions.run(() => firstValueFrom(this.api.post(apiUrl('tags', 'createTag'), { name }, createdResponseSchema)), {
      success: { key: 'library.tags.created', params: { name } },
    });
    if (!done) return;
    this.creating.set(false);
    this.changed();
  }

  protected async rename(tag: ClubTagItem, name: string): Promise<void> {
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('tags', 'renameTag', { tagId: tag.id }), { name })));
    if (!done) return;
    this.renaming.set(null);
    this.changed();
  }

  protected async remove(tag: ClubTagItem): Promise<void> {
    if (!(await this.confirm.confirmDelete('library.tags.deleteTitle', 'library.tags.deleteText', { name: tag.name, count: tag.scoreCount }))) return;
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('tags', 'deleteTag', { tagId: tag.id }))), {
      success: { key: 'library.tags.deleted', params: { name: tag.name } },
    });
    if (done) this.changed();
  }

  private changed(): void {
    this.list.reload();
    this.options.reloadTags();
  }
}
