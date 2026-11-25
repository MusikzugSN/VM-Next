import { Inject, Injectable } from '@nestjs/common';
import type { Permission } from '@vm-web/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { appendTo } from '../common/collections';
import { uuidv7 } from '../common/ids/uuid-v7';
import type { CursorKey } from '../common/pagination/cursor';
import { afterNameAndId } from '../common/pagination/keyset';
import { DATABASE, type Database, type Tx } from '../db/database';
import { memberships, rolePermissions, roles } from '../db/schema';
import { replaceRows } from '../db/table-helpers';
import type { DefaultRole } from '../seed/default-roles';
import { lockClubSettings } from './club-settings-lock';

export type RoleRecord = typeof roles.$inferSelect;

export interface RoleDeleteState {
  role: RoleRecord | undefined;
  isDefaultRole: boolean;
  isAssigned: boolean;
}

@Injectable()
export class RolesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async find(roleId: string): Promise<RoleRecord | undefined> {
    const [row] = await this.db.select().from(roles).where(eq(roles.id, roleId));
    return row;
  }

  page(cursor: CursorKey | undefined, limit: number): Promise<{ role: RoleRecord; sortKey: string }[]> {
    return this.db
      .select({ role: roles, sortKey: sql<string>`lower(${roles.name})` })
      .from(roles)
      .where(afterNameAndId(roles.name, roles.id, cursor))
      .orderBy(sql`lower(${roles.name})`, asc(roles.id))
      .limit(limit + 1);
  }

  async permissionsOf(roleIds: readonly string[]): Promise<Map<string, Permission[]>> {
    const result = new Map<string, Permission[]>();
    if (!roleIds.length) return result;
    const rows = await this.db.select().from(rolePermissions).where(inArray(rolePermissions.roleId, [...roleIds]));
    for (const r of rows) appendTo(result, r.roleId, r.permission as Permission);
    return result;
  }

  async assignmentCounts(roleIds: readonly string[]): Promise<Map<string, number>> {
    if (!roleIds.length) return new Map();
    const rows = await this.db
      .select({ roleId: memberships.roleId, n: sql<number>`count(*)` })
      .from(memberships)
      .where(inArray(memberships.roleId, [...roleIds]))
      .groupBy(memberships.roleId);
    return new Map(rows.map((r) => [r.roleId, r.n]));
  }

  async create(name: string, permissions: readonly Permission[]): Promise<string> {
    const id = uuidv7();
    await this.db.transaction(async (tx) => {
      await tx.insert(roles).values({ id, name });
      await writePermissions(tx, id, permissions);
    });
    return id;
  }

  async rename(roleId: string, name: string): Promise<void> {
    await this.db.update(roles).set({ name, updatedAt: new Date() }).where(eq(roles.id, roleId));
  }

  setPermissions(roleId: string, permissions: readonly Permission[]): Promise<void> {
    return this.db.transaction(async (tx) => {
      await writePermissions(tx, roleId, permissions);
      await tx.update(roles).set({ updatedAt: new Date() }).where(eq(roles.id, roleId));
    });
  }

  reset(roleId: string, name: string, permissions: readonly Permission[]): Promise<void> {
    return this.db.transaction(async (tx) => {
      await tx.update(roles).set({ name, updatedAt: new Date() }).where(eq(roles.id, roleId));
      await writePermissions(tx, roleId, permissions);
    });
  }

  delete(roleId: string, check: (state: RoleDeleteState) => void): Promise<void> {
    return this.db.transaction(async (tx) => {
      const settings = await lockClubSettings(tx);
      const [role] = await tx.select().from(roles).where(eq(roles.id, roleId)).for('update');
      const [assigned] = await tx.select({ userId: memberships.userId }).from(memberships).where(eq(memberships.roleId, roleId)).limit(1).for('share');
      check({ role, isDefaultRole: settings.defaultRoleId === roleId, isAssigned: !!assigned });
      await tx.delete(roles).where(eq(roles.id, roleId));
    });
  }

  resetDefaults(defaults: Iterable<DefaultRole>): Promise<{ reset: number; recreated: number }> {
    return this.db.transaction(async (tx) => {
      let reset = 0;
      let recreated = 0;
      for (const def of defaults) {
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
}

async function writePermissions(tx: Tx, roleId: string, permissions: readonly Permission[]): Promise<void> {
  const unique = [...new Set(permissions)];
  await replaceRows(tx, rolePermissions, eq(rolePermissions.roleId, roleId), unique.map((permission) => ({ roleId, permission })));
}

async function freeName(tx: Tx, name: string, ownId: string | undefined): Promise<string> {
  const [taken] = await tx
    .select({ id: roles.id })
    .from(roles)
    .where(and(sql`lower(${roles.name}) = lower(${name})`, ownId ? sql`${roles.id} <> ${ownId}` : undefined));
  return taken ? `${name} (Standard)` : name;
}
