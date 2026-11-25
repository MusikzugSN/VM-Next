import { Inject, Injectable } from '@nestjs/common';
import type { EnsembleOption, Permission, UserTableQuery, VoiceRef } from '@vm-web/shared';
import { and, asc, count, eq, inArray, like, or, sql } from 'drizzle-orm';
import type { AccessContext } from '../access/access-context';
import type { CursorKey } from '../common/pagination/cursor';
import { afterNameAndId } from '../common/pagination/keyset';
import { likePattern } from '../common/sql';
import { DATABASE, type Database, type Tx } from '../db/database';
import { ensembles, memberships, roles, users, userVoices, voices } from '../db/schema';
import { replaceRows } from '../db/table-helpers';
import { ensembleOptions, roleOptions } from '../library/library-helpers';
import { lockClubSettings } from './club-settings-lock';

export type UserRecord = typeof users.$inferSelect;

export interface UserMembershipRow {
  userId: string;
  ensemble: { id: string; name: string };
  role: { id: string; name: string };
}

export interface MembershipState {
  user: UserRecord | undefined;
  ensemble: { archivedAt: Date | null } | undefined;
  roleExists: boolean;
}

export interface AdminGuardState {
  user: UserRecord | undefined;
  activeAdmins: number;
}

@Injectable()
export class SystemUsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async find(userId: string): Promise<UserRecord | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    return user;
  }

  page(query: UserTableQuery, cursor: CursorKey | undefined): Promise<{ user: UserRecord; sortKey: string }[]> {
    return this.db
      .select({ user: users, sortKey: sql<string>`lower(${users.name})` })
      .from(users)
      .where(
        and(
          query.q ? or(like(users.name, likePattern(query.q)), like(users.email, likePattern(query.q))) : undefined,
          query.status ? eq(users.status, query.status) : undefined,
          query.ensembleId ? sql`exists (select 1 from memberships m where m.user_id = ${users.id} and m.ensemble_id = ${query.ensembleId})` : undefined,
          afterNameAndId(users.name, users.id, cursor),
        ),
      )
      .orderBy(sql`lower(${users.name})`, asc(users.id))
      .limit(query.limit + 1);
  }

  async memberships(userIds: readonly string[]): Promise<UserMembershipRow[]> {
    if (!userIds.length) return [];
    return this.db
      .select({ userId: memberships.userId, ensemble: { id: ensembles.id, name: ensembles.name }, role: { id: roles.id, name: roles.name } })
      .from(memberships)
      .innerJoin(ensembles, eq(ensembles.id, memberships.ensembleId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(inArray(memberships.userId, [...userIds]))
      .orderBy(sql`lower(${ensembles.name})`);
  }

  async profileVoices(userIds: readonly string[]): Promise<(VoiceRef & { userId: string })[]> {
    if (!userIds.length) return [];
    return this.db
      .select({ userId: userVoices.userId, id: voices.id, name: voices.name, instrumentId: voices.instrumentId })
      .from(userVoices)
      .innerJoin(voices, eq(voices.id, userVoices.voiceId))
      .where(inArray(userVoices.userId, [...userIds]))
      .orderBy(asc(userVoices.position));
  }

  activeAdminCount(): Promise<number> {
    return activeAdmins(this.db);
  }

  ensembleOptions(access: AccessContext, permission: Permission): Promise<EnsembleOption[]> {
    return ensembleOptions(this.db, access, permission);
  }

  roleOptions(): Promise<{ id: string; name: string }[]> {
    return roleOptions(this.db);
  }

  async existingVoiceIds(voiceIds: readonly string[]): Promise<Set<string>> {
    if (!voiceIds.length) return new Set();
    const rows = await this.db.select({ id: voices.id }).from(voices).where(inArray(voices.id, [...voiceIds]));
    return new Set(rows.map((v) => v.id));
  }

  setMembership(userId: string, ensembleId: string, roleId: string, check: (state: MembershipState) => void): Promise<void> {
    return this.db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('share');
      const [ensemble] = await tx.select({ archivedAt: ensembles.archivedAt }).from(ensembles).where(eq(ensembles.id, ensembleId)).for('share');
      const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId)).for('share');
      check({ user, ensemble, roleExists: !!role });
      await tx.insert(memberships).values({ userId, ensembleId, roleId }).onDuplicateKeyUpdate({ set: { roleId } });
    });
  }

  async removeMembership(userId: string, ensembleId: string): Promise<boolean> {
    const [result] = await this.db.delete(memberships).where(and(eq(memberships.userId, userId), eq(memberships.ensembleId, ensembleId)));
    return result.affectedRows > 0;
  }

  setVoices(userId: string, voiceIds: readonly string[]): Promise<void> {
    return this.db.transaction(async (tx) => {
      await replaceRows(tx, userVoices, eq(userVoices.userId, userId), voiceIds.map((voiceId, position) => ({ userId, voiceId, position })));
    });
  }

  async setStatus(userId: string, status: UserRecord['status']): Promise<void> {
    await this.db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async grantAdmin(userId: string): Promise<void> {
    await this.db.update(users).set({ isAdmin: true, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  block(userId: string, check: (state: AdminGuardState) => void): Promise<void> {
    return this.guardedByAdmins(userId, check, (tx) => tx.update(users).set({ status: 'blocked', updatedAt: new Date() }).where(eq(users.id, userId)));
  }

  revokeAdmin(userId: string, check: (state: AdminGuardState) => void): Promise<void> {
    return this.guardedByAdmins(userId, check, (tx) => tx.update(users).set({ isAdmin: false, updatedAt: new Date() }).where(eq(users.id, userId)));
  }

  delete(userId: string, check: (state: AdminGuardState) => void): Promise<void> {
    return this.guardedByAdmins(userId, check, (tx) => tx.delete(users).where(eq(users.id, userId)));
  }

  private guardedByAdmins(userId: string, check: (state: AdminGuardState) => void, write: (tx: Tx) => Promise<unknown>): Promise<void> {
    return this.db.transaction(async (tx) => {
      await lockClubSettings(tx);
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
      check({ user, activeAdmins: await activeAdmins(tx, true) });
      await write(tx);
    });
  }
}

async function activeAdmins(db: Database | Tx, locked = false): Promise<number> {
  const query = db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.isAdmin, true), eq(users.status, 'active')));
  const [{ n }] = locked ? await query.for('share') : await query;
  return n;
}
