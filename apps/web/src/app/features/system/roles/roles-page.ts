import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRotateCcw, lucideTriangleAlert } from '@ng-icons/lucide';
import { APP_ROUTES, apiUrl, appPath, createdResponseSchema, resetDefaultsResponseSchema, roleListResponseSchema, type RoleListItem } from '@vm-web/shared';

import { VmBadge, VmButton, VmCard } from '@vm-web/ui';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { cursorList } from '../../../core/api/cursor-list';
import { SessionStore } from '../../../core/auth/session.store';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { ListState } from '../../../shared/ui/list-state';
import { NameDialog } from '../../../shared/ui/name-dialog';

/** Rollen (S-3, R-5): list with badges, create, reset all default roles. */
@Component({
  selector: 'vm-system-roles-page',
  imports: [VmBadge, VmCard, RouterLink, NgIcon, TranslocoPipe, PluralPipe, VmButton, ListState, NameDialog],
  viewProviders: [provideIcons({ lucidePlus, lucideRotateCcw, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 class="text-headline-small">{{ 'nav.system.roles' | transloco }}</h1>
        <p class="mt-2 text-muted-foreground">{{ 'system.roles.intro' | transloco }}</p>
      </div>
      <div class="flex flex-col gap-2 md:flex-row">
        @if (canEdit()) {
          <button vm-button variant="outlined" type="button" (click)="resetAll()">
            <ng-icon name="lucideRotateCcw" aria-hidden="true" />{{ 'system.roles.resetAll' | transloco }}
          </button>
        }
        @if (canCreate()) {
          <button vm-button type="button" (click)="creating.set(true)">
            <ng-icon name="lucidePlus" aria-hidden="true" />{{ 'system.roles.create' | transloco }}
          </button>
        }
      </div>
    </div>

    <vm-name-dialog [(open)]="creating" titleKey="system.roles.create" labelKey="system.roles.newRole" [save]="create" />

    <ul vm-card class="overflow-hidden" [class.hidden]="list.items().length === 0">
      @for (role of list.items(); track role.id; let first = $first) {
        <li class="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:gap-3" [class.border-t]="!first">
          <a [routerLink]="link(role)" class="font-medium">{{ role.name }}</a>
          <span class="flex flex-1 flex-wrap items-center gap-1.5 text-body-medium text-muted-foreground">
            @if (role.defaultKey) {
              <span class="rounded-sm bg-muted px-1.5 py-0.5 text-body-small">{{ 'system.roles.default' | transloco }}</span>
            }
            @if (role.modifiedFromDefault) {
              <span class="rounded-sm bg-warning-soft px-1.5 py-0.5 text-body-small text-warning-ink">{{ 'system.roles.modified' | transloco }}</span>
            }
            @if (role.hasClubPermissions) {
              <span vm-badge tone="error">
                <ng-icon name="lucideTriangleAlert" size="12" aria-hidden="true" />{{ 'system.roles.clubPermissions' | transloco }}
              </span>
            }
            <span>{{ 'system.roles.assignmentCount' | tPlural: role.assignmentCount }}</span>
          </span>
        </li>
      }
    </ul>
    <vm-list-state [list]="list" emptyKey="system.roles.empty" />
  `,
})
export class RolesPage {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly canCreate = computed(() => this.session.can('role.create'));
  protected readonly canEdit = computed(() => this.session.can('role.edit'));
  protected readonly creating = signal(false);

  protected readonly list = cursorList({
    params: () => null,
    fetch: (_, cursor) => this.api.get(apiUrl('system', 'roleList'), roleListResponseSchema, { cursor }),
  });

  protected link(role: RoleListItem): string {
    return appPath(APP_ROUTES.system.role, { roleId: role.id });
  }

  protected readonly create = async (name: string): Promise<boolean> => {
    const done = await this.actions.runOnce(
      () => this.api.post(apiUrl('system', 'createRole'), { name, permissions: [] }, createdResponseSchema),
      { success: { key: 'system.roles.created', params: { name } } },
    );
    // Straight to the matrix: a new role without permissions is of little use.
    if (done) void this.router.navigateByUrl(appPath(APP_ROUTES.system.role, { roleId: done.value.id }));
    return !!done;
  };

  protected async resetAll(): Promise<void> {
    if (!(await this.confirm.confirm('system.roles.resetAllTitle', 'system.roles.resetAllText', {}, 'system.roles.resetOk'))) return;
    const done = await this.actions.runOnce(() => this.api.post(apiUrl('system', 'resetAllRoles'), {}, resetDefaultsResponseSchema));
    if (!done) return;
    this.actions.notify('system.roles.resetAllDone', { ...done.value });
    this.list.reload();
    void this.session.reload();
  }
}
