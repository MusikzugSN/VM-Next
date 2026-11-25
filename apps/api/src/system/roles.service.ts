import { Inject, Injectable } from '@nestjs/common';
import {
  ALL_PERMISSIONS,
  PERMISSION_ACTIONS,
  PERMISSION_AREAS,
  permissionScope,
  SINGLE_PERMISSIONS,
  type CursorQuery,
  type Page,
  type Permission,
  type PermissionCatalogResponse,
  type ResetDefaultsResponse,
  type RoleDetailsResponse,
  type RoleListItem,
} from '@vm-web/shared';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { withNameTaken } from '../db/db-errors';
import { loadDefaultRoles, type DefaultRole } from '../seed/default-roles';
import { rolesFile } from '../seed/defaults';
import { RolesRepository, type RoleRecord } from './roles.repository';

const sorted = (permissions: readonly string[]) => ALL_PERMISSIONS.filter((p) => permissions.includes(p));

@Injectable()
export class RolesService {
  constructor(@Inject(RolesRepository) private readonly repo: RolesRepository) {}

  async list(query: CursorQuery): Promise<Page<RoleListItem>> {
    const rows = await this.repo.page(decodeCursor(query.cursor, 2), query.limit);
    const page = rows.slice(0, query.limit).map((r) => r.role);
    const [permissions, counts, defaults] = await Promise.all([this.permissionsOf(page.map((r) => r.id)), this.repo.assignmentCounts(page.map((r) => r.id)), this.defaults()]);
    return toPage(rows, query.limit, (r) => [r.sortKey, r.role.id], (r) => this.item(r.role, permissions.get(r.role.id) ?? [], counts.get(r.role.id) ?? 0, defaults));
  }

  catalog(): PermissionCatalogResponse {
    return {
      actions: [...PERMISSION_ACTIONS],
      areas: (Object.keys(PERMISSION_AREAS) as (keyof typeof PERMISSION_AREAS)[]).map((area) => ({
        area,
        scope: PERMISSION_AREAS[area],
        permissions: PERMISSION_ACTIONS.map((a) => `${area}.${a}` as Permission),
      })),
      singles: (Object.keys(SINGLE_PERMISSIONS) as Permission[]).map((permission) => ({ permission, scope: permissionScope(permission) })),
    };
  }

  async details(roleId: string): Promise<RoleDetailsResponse> {
    const role = await this.role(roleId);
    const [permissions, counts, defaults] = await Promise.all([this.permissionsOf([roleId]), this.repo.assignmentCounts([roleId]), this.defaults()]);
    const list = permissions.get(roleId) ?? [];
    return { ...this.item(role, list, counts.get(roleId) ?? 0, defaults), permissions: list };
  }

  async create(name: string, permissions: readonly Permission[]): Promise<{ id: string }> {
    return { id: await withNameTaken(() => this.repo.create(name, permissions)) };
  }

  async rename(roleId: string, name: string): Promise<void> {
    await this.role(roleId);
    await withNameTaken(() => this.repo.rename(roleId, name));
  }

  async setPermissions(roleId: string, permissions: readonly Permission[]): Promise<void> {
    await this.role(roleId);
    await this.repo.setPermissions(roleId, permissions);
  }

  async delete(roleId: string): Promise<void> {
    await this.repo.delete(roleId, ({ role, isDefaultRole, isAssigned }) => {
      if (!role) throw ProblemException.notFound();
      if (role.defaultKey === 'admin') throw ProblemException.conflict('in-use', 'The admin role is required');
      if (isDefaultRole) throw ProblemException.conflict('in-use', 'Default role for new accounts');
      if (isAssigned) throw ProblemException.conflict('in-use', 'Role is assigned');
    });
  }

  async resetToDefault(roleId: string): Promise<void> {
    const role = await this.role(roleId);
    const def = role.defaultKey ? (await this.defaults()).get(role.defaultKey) : undefined;
    if (!def) throw ProblemException.conflict('not-default-role');
    await withNameTaken(() => this.repo.reset(roleId, def.name, def.permissions));
  }

  async resetDefaults(): Promise<ResetDefaultsResponse> {
    return this.repo.resetDefaults((await this.defaults()).values());
  }

  private item(role: RoleRecord, permissions: readonly Permission[], assignmentCount: number, defaults: Map<string, DefaultRole>): RoleListItem {
    const def = role.defaultKey ? defaults.get(role.defaultKey) : undefined;
    const modifiedFromDefault =
      !!def && (def.name !== role.name || def.permissions.length !== permissions.length || def.permissions.some((p) => !permissions.includes(p)));
    return {
      id: role.id,
      defaultKey: role.defaultKey,
      name: role.name,
      hasClubPermissions: permissions.some((p) => permissionScope(p) === 'club'),
      modifiedFromDefault,
      assignmentCount,
    };
  }

  private async defaults(): Promise<Map<string, DefaultRole>> {
    return new Map((await loadDefaultRoles(rolesFile())).roles.map((r) => [r.key, r]));
  }

  private async permissionsOf(roleIds: readonly string[]): Promise<Map<string, Permission[]>> {
    const result = await this.repo.permissionsOf(roleIds);
    for (const [id, list] of result) result.set(id, sorted(list));
    return result;
  }

  private async role(roleId: string): Promise<RoleRecord> {
    const row = await this.repo.find(roleId);
    if (!row) throw ProblemException.notFound();
    return row;
  }
}
