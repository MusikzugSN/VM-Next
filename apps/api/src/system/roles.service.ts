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
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { uuidv7 } from '../common/ids/uuid-v7';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { DATABASE, type Database, type Tx } from '../db/database';
import { isUniqueViolation } from '../db/db-errors';
import { clubSettings, memberships, rolePermissions, roles } from '../db/schema';
import { loadDefaultRoles, type DefaultRole } from '../seed/default-roles';
import { rolesFile } from '../seed/defaults';

type RoleRecord = typeof roles.$inferSelect;

const sorted = (permissions: readonly string[]) => ALL_PERMISSIONS.filter((p) => permissions.includes(p));

/** Roles with permission matrix and default roles (S-3, R-3, R-5, R-7). */
@Injectable()
export class RolesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(query: CursorQuery): Promise<Page<RoleListItem>> {
    const cursor = decodeCursor(query.cursor, 2);
    const rows = await this.db
      .select({ role: roles, sortKey: sql<string>`lower(${roles.name})` })
      .from(roles)
      .where(cursor ? sql`(lower(${roles.name}), ${roles.id}) > (${cursor[0]}, ${cursor[1]}::uuid)` : undefined)
      .orderBy(sql`lower(${roles.name})`, asc(roles.id))
      .limit(query.limit + 1);
    const page = rows.slice(0, query.limit).map((r) => r.role);
    const [permissions, counts, defaults] = await Promise.all([this.permissionsOf(page.map((r) => r.id)), this.assignmentCounts(page.map((r) => r.id)), this.defaults()]);
    return toPage(rows, query.limit, (r) => [r.sortKey, r.role.id], (r) => this.item(r.role, permissions.get(r.role.id) ?? [], counts.get(r.role.id) ?? 0, defaults));
  }

  /** Rows = areas, columns = actions, plus single permissions (R-7). Codes only. */
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
    const [permissions, counts, defaults] = await Promise.all([this.permissionsOf([roleId]), this.assignmentCounts([roleId]), this.defaults()]);
    const list = permissions.get(roleId) ?? [];
    return { ...this.item(role, list, counts.get(roleId) ?? 0, defaults), permissions: list };
  }

  async create(name: string, permissions: readonly Permission[]): Promise<{ id: string }> {
    const id = uuidv7();
    await this.unique(() =>
      this.db.transaction(async (tx) => {
        await tx.insert(roles).values({ id, name });
        await writePermissions(tx, id, permissions);
      }),
    );
    return { id };
  }

  async rename(roleId: string, name: string): Promise<void> {
    await this.role(roleId);
    await this.unique(() => this.db.update(roles).set({ name, updatedAt: new Date() }).where(eq(roles.id, roleId)));
  }

  async setPermissions(roleId: string, permissions: readonly Permission[]): Promise<void> {
    await this.role(roleId);
    await this.db.transaction(async (tx) => {
      await writePermissions(tx, roleId, permissions);
      await tx.update(roles).set({ updatedAt: new Date() }).where(eq(roles.id, roleId));
    });
  }

  /** Not while assigned, not the default role for new accounts, never the `admin` role (F-3). */
  async delete(roleId: string): Promise<void> {
    const role = await this.role(roleId);
    if (role.defaultKey === 'admin') throw ProblemException.conflict('in-use', 'The admin role is required');
    const [settings] = await this.db.select({ defaultRoleId: clubSettings.defaultRoleId }).from(clubSettings);
    if (settings?.defaultRoleId === roleId) throw ProblemException.conflict('in-use', 'Default role for new accounts');
    const [assigned] = await this.db.select({ userId: memberships.userId }).from(memberships).where(eq(memberships.roleId, roleId)).limit(1);
    if (assigned) throw ProblemException.conflict('in-use', 'Role is assigned');
    await this.db.delete(roles).where(eq(roles.id, roleId));
  }

  /** Name and permissions back to `roles.default.json` (R-5). */
  async resetToDefault(roleId: string): Promise<void> {
    const role = await this.role(roleId);
    const def = role.defaultKey ? (await this.defaults()).get(role.defaultKey) : undefined;
    if (!def) throw ProblemException.conflict('not-default-role');
    await this.unique(() =>
      this.db.transaction(async (tx) => {
        await tx.update(roles).set({ name: def.name, updatedAt: new Date() }).where(eq(roles.id, roleId));
        await writePermissions(tx, roleId, def.permissions);
      }),
    );
  }

  /**
   * Resets every default role and re-creates deleted ones (R-5); own roles stay.
   * A re-created role whose name is taken by an own role gets „ (Standard)“ appended.
   */
  async resetDefaults(): Promise<ResetDefaultsResponse> {
    const defaults = await this.defaults();
    return this.db.transaction(async (tx) => {
      let reset = 0;
      let recreated = 0;
      for (const def of defaults.values()) {
        const [existing] = await tx.select().from(roles).where(eq(roles.defaultKey, def.key));
        const name = await freeName(tx, def.name, existing?.id);
        if (existing) {
          await tx.update(roles).set({ name, updatedAt: new Date() }).where(eq(roles.id, existing.id));
          await writePermissions(tx, existing.id, def.permissions);
          reset++;
        } else {
          const id = uuidv7();
          await tx.insert(roles).values({ id, defaultKey: def.key, name });
          await writePermissions(tx, id, def.permissions);
          recreated++;
        }
      }
      return { reset, recreated };
    });
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
    const result = new Map<string, Permission[]>();
    if (!roleIds.length) return result;
    const rows = await this.db.select().from(rolePermissions).where(inArray(rolePermissions.roleId, [...roleIds]));
    for (const r of rows) result.set(r.roleId, [...(result.get(r.roleId) ?? []), r.permission as Permission]);
    for (const [id, list] of result) result.set(id, sorted(list));
    return result;
  }

  private async assignmentCounts(roleIds: readonly string[]): Promise<Map<string, number>> {
    if (!roleIds.length) return new Map();
    const rows = await this.db
      .select({ roleId: memberships.roleId, n: sql<number>`count(*)::int` })
      .from(memberships)
      .where(inArray(memberships.roleId, [...roleIds]))
      .groupBy(memberships.roleId);
    return new Map(rows.map((r) => [r.roleId, r.n]));
  }

  private async role(roleId: string): Promise<RoleRecord> {
    const [row] = await this.db.select().from(roles).where(eq(roles.id, roleId));
    if (!row) throw ProblemException.notFound();
    return row;
  }

  private async unique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error)) throw ProblemException.conflict('name-taken');
      throw error;
    }
  }
}

async function writePermissions(tx: Tx, roleId: string, permissions: readonly Permission[]): Promise<void> {
  await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  const unique = [...new Set(permissions)];
  if (unique.length) await tx.insert(rolePermissions).values(unique.map((permission) => ({ roleId, permission })));
}

async function freeName(tx: Tx, name: string, ownId: string | undefined): Promise<string> {
  const [taken] = await tx
    .select({ id: roles.id })
    .from(roles)
    .where(and(sql`lower(${roles.name}) = lower(${name})`, ownId ? sql`${roles.id} <> ${ownId}::uuid` : undefined));
  return taken ? `${name} (Standard)` : name;
}
