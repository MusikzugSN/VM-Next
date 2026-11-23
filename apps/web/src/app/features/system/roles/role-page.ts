import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideRotateCcw, lucideTrash2, lucideTriangleAlert } from '@ng-icons/lucide';
import { APP_ROUTES, apiUrl, permissionCatalogResponseSchema, permissionScope, roleDetailsResponseSchema, type Permission } from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { SessionStore } from '../../../core/auth/session.store';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { NameDialog } from '../../../shared/ui/name-dialog';
import { PageProblem } from '../../../shared/ui/page-problem';
import { permissionKey, withDependencies } from './permission-labels';
import { usePageName } from '../../../core/layout/page';
import { valueOr } from '../../../core/util/resource-value';

/** Rolle (S-3, R-3, R-7): permission matrix (areas × actions) plus single permissions. */
@Component({
  selector: 'vm-system-role-page',
  imports: [RouterLink, NgIcon, TranslocoPipe, PluralPipe, ZardButtonComponent, NameDialog, PageProblem],
  viewProviders: [provideIcons({ lucideChevronLeft, lucideRotateCcw, lucideTrash2, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-page.html',
})
export class RolePage {
  /** Breadcrumb and document title show the loaded element's name. */
  private readonly pageName = usePageName(() => this.role()?.name);
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  /** Route parameter. */
  readonly roleId = input.required<string>();

  protected readonly listPath = APP_ROUTES.system.roles;
  protected readonly canEdit = computed(() => this.session.can('role.edit'));
  protected readonly canDelete = computed(() => this.session.can('role.delete'));
  protected readonly renaming = signal(false);
  protected readonly saving = signal(false);

  protected readonly details = rxResource({
    params: () => this.roleId(),
    stream: ({ params }) => this.api.get(apiUrl('system', 'roleDetails', { roleId: params }), roleDetailsResponseSchema),
  });
  protected readonly catalog = rxResource({
    stream: () => this.api.get(apiUrl('system', 'permissionCatalog'), permissionCatalogResponseSchema),
  });
  protected readonly role = computed(() => valueOr(this.details, null));

  protected readonly selected = signal<ReadonlySet<Permission>>(new Set());
  protected readonly dirty = computed(() => {
    const saved = new Set(this.role()?.permissions ?? []);
    const chosen = this.selected();
    return saved.size !== chosen.size || [...chosen].some((p) => !saved.has(p));
  });
  /** Live warning while editing (B-1): the role would grant club-wide permissions. */
  protected readonly grantsClub = computed(() => [...this.selected()].some((p) => permissionScope(p) === 'club'));
  protected readonly key = permissionKey;

  constructor() {
    effect(() => {
      const role = this.role();
      if (role) untracked(() => this.selected.set(new Set(role.permissions)));
    });
  }

  protected has(permission: Permission | undefined): boolean {
    return permission !== undefined && this.selected().has(permission);
  }

  /** Permission of one cell, `undefined` if the area has no such action. */
  protected cell(permissions: readonly Permission[], action: string): Permission | undefined {
    return permissions.find((p) => p.endsWith(`.${action}`));
  }

  protected toggle(permission: Permission, on: boolean): void {
    this.selected.update((current) => withDependencies(current, permission, on));
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    const done = await this.actions.run(
      () => firstValueFrom(this.api.postVoid(apiUrl('system', 'setPermissions', { roleId: this.roleId() }), { permissions: [...this.selected()] })),
      { success: { key: 'system.role.saved' } },
    );
    this.saving.set(false);
    if (done) this.changed();
  }

  protected readonly rename = async (name: string): Promise<boolean> => {
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('system', 'renameRole', { roleId: this.roleId() }), { name })), {
      success: { key: 'system.role.renamed', params: { name } },
    });
    if (done) this.details.reload();
    return !!done;
  };

  protected async reset(): Promise<void> {
    const name = this.role()?.name ?? '';
    if (!(await this.confirm.confirm('system.role.resetTitle', 'system.role.resetText', { name }, 'system.roles.resetOk'))) return;
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('system', 'resetRole', { roleId: this.roleId() }))), {
      success: { key: 'system.role.resetDone', params: { name } },
    });
    if (done) this.changed();
  }

  protected async remove(): Promise<void> {
    const role = this.role();
    if (!role) return;
    if (!(await this.confirm.confirmDelete('system.role.deleteTitle', 'system.role.deleteText', { name: role.name }))) return;
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('system', 'deleteRole', { roleId: this.roleId() }))), {
      success: { key: 'system.role.deleted', params: { name: role.name } },
    });
    if (done) void this.router.navigateByUrl(this.listPath);
  }

  private changed(): void {
    this.details.reload();
    void this.session.reload();
  }
}
