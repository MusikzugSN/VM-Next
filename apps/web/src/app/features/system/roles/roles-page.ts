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
  templateUrl: './roles-page.html',
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
