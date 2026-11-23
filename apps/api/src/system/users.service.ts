import { Inject, Injectable } from '@nestjs/common';
import type {
  Page,
  UserAssignmentOptionsResponse,
  UserDetailsResponse,
  UserRow,
  UserTableQuery,
  VoiceRef,
} from '@vm-web/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { activeEnsembleOptions } from '../common/ensemble-tree';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { httpUrlOrNull } from '../common/url';
import { DATABASE, type Database } from '../db/database';
import { ensembles, memberships, roles, users, userVoices, voices } from '../db/schema';
import { likePattern } from '../common/sql';

type UserRecord = typeof users.$inferSelect;

/** User administration (S-1, A-5, R-1, R-6, Datenschutz). */
@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async table(query: UserTableQuery): Promise<Page<UserRow>> {
    const cursor = decodeCursor(query.cursor, 2);
    const rows = await this.db
      .select({ user: users, sortKey: sql<string>`lower(${users.name})` })
      .from(users)
      .where(
        and(
          query.q ? sql`(${users.name} ilike ${likePattern(query.q)} or ${users.email} ilike ${likePattern(query.q)})` : undefined,
          query.status ? eq(users.status, query.status) : undefined,
          query.ensembleId ? sql`exists (select 1 from memberships m where m.user_id = ${users.id} and m.ensemble_id = ${query.ensembleId}::uuid)` : undefined,
          cursor ? sql`(lower(${users.name}), ${users.id}) > (${cursor[0]}, ${cursor[1]}::uuid)` : undefined,
        ),
      )
      .orderBy(sql`lower(${users.name})`, asc(users.id))
      .limit(query.limit + 1);
    const page = rows.slice(0, query.limit).map((r) => r.user);
    const extras = await this.extras(page.map((u) => u.id));
    return toPage(rows, query.limit, (r) => [r.sortKey, r.user.id], (r) => toRow(r.user, extras));
  }

  async details(userId: string): Promise<UserDetailsResponse> {
    const user = await this.user(userId);
    const extras = await this.extras([userId]);
    return {
      ...toRow(user, extras),
      createdAt: user.createdAt.toISOString(),
      canBeDemoted: !(await this.isLastAdmin(user)),
    };
  }

  async assignmentOptions(): Promise<UserAssignmentOptionsResponse> {
    const [ensembleRows, roleRows] = await Promise.all([
      activeEnsembleOptions(this.db),
      this.db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(sql`lower(${roles.name})`),
    ]);
    return { ensembles: ensembleRows, roles: roleRows };
  }

  /** Creates or changes the membership in one ensemble (R-1); archived ensembles are refused. */
  async setMembership(userId: string, ensembleId: string, roleId: string): Promise<void> {
    await this.user(userId);
    const [ensemble] = await this.db.select({ archivedAt: ensembles.archivedAt }).from(ensembles).where(eq(ensembles.id, ensembleId));
    if (!ensemble) throw ProblemException.notFound('Unknown ensemble');
    if (ensemble.archivedAt) throw ProblemException.validation([{ path: '/body/ensembleId', code: 'archived' }]);
    const [role] = await this.db.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId));
    if (!role) throw ProblemException.notFound('Unknown role');
    await this.db
      .insert(memberships)
      .values({ userId, ensembleId, roleId })
      .onConflictDoUpdate({ target: [memberships.userId, memberships.ensembleId], set: { roleId } });
  }

  async removeMembership(userId: string, ensembleId: string): Promise<void> {
    const removed = await this.db
      .delete(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.ensembleId, ensembleId)))
      .returning({ userId: memberships.userId });
    if (!removed.length) throw ProblemException.notFound();
  }

  /** Pre-assigns profile voices (S-1, M-1); empty list allowed. */
  async setVoices(userId: string, voiceIds: readonly string[]): Promise<void> {
    await this.user(userId);
    const unique = [...new Set(voiceIds)];
    const found = new Set(
      unique.length ? (await this.db.select({ id: voices.id }).from(voices).where(inArray(voices.id, unique))).map((v) => v.id) : [],
    );
    const unknown = voiceIds.map((id, i) => [id, i] as const).filter(([id]) => !found.has(id));
    if (unknown.length) throw ProblemException.validation(unknown.map(([, i]) => ({ path: `/body/voiceIds/${i}`, code: 'unknown_voice' })));
    await this.db.transaction(async (tx) => {
      await tx.delete(userVoices).where(eq(userVoices.userId, userId));
      if (unique.length) await tx.insert(userVoices).values(unique.map((voiceId, position) => ({ userId, voiceId, position })));
    });
  }

  /** Blocks an account; its sessions end with the next request (A-5). */
  async block(actorId: string, userId: string): Promise<void> {
    const user = await this.user(userId);
    if (userId === actorId || (await this.isLastAdmin(user))) throw ProblemException.conflict('last-admin');
    await this.db.update(users).set({ status: 'blocked', updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async unblock(userId: string): Promise<void> {
    await this.user(userId);
    await this.db.update(users).set({ status: 'active', updatedAt: new Date() }).where(eq(users.id, userId));
  }

  /** Admin flag as emergency access (R-6); the last active admin cannot be demoted. */
  async setAdmin(userId: string, isAdmin: boolean): Promise<void> {
    const user = await this.user(userId);
    if (!isAdmin && (await this.isLastAdmin(user))) throw ProblemException.conflict('last-admin');
    await this.db.update(users).set({ isAdmin, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  /**
   * Deletes the account with all personal data (memberships, profile voices, personal tags);
   * uploads and sheets stay without a name (Datenschutz, F-15).
   */
  async delete(actorId: string, userId: string): Promise<void> {
    const user = await this.user(userId);
    if (userId === actorId || (await this.isLastAdmin(user))) throw ProblemException.conflict('last-admin');
    await this.db.delete(users).where(eq(users.id, userId));
  }

  private async user(userId: string): Promise<UserRecord> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw ProblemException.notFound();
    return user;
  }

  /** Whether the user is the only active account with the admin flag. */
  private async isLastAdmin(user: UserRecord): Promise<boolean> {
    if (!user.isAdmin || user.status !== 'active') return false;
    const [{ n }] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.isAdmin, true), eq(users.status, 'active')));
    return n <= 1;
  }

  /** Memberships and profile voices for a page of users (two queries). */
  async extras(userIds: readonly string[]) {
    const memberRows = userIds.length
      ? await this.db
          .select({ userId: memberships.userId, ensemble: { id: ensembles.id, name: ensembles.name }, role: { id: roles.id, name: roles.name } })
          .from(memberships)
          .innerJoin(ensembles, eq(ensembles.id, memberships.ensembleId))
          .innerJoin(roles, eq(roles.id, memberships.roleId))
          .where(inArray(memberships.userId, [...userIds]))
          .orderBy(sql`lower(${ensembles.name})`)
      : [];
    const voiceRows = userIds.length
      ? await this.db
          .select({ userId: userVoices.userId, id: voices.id, name: voices.name, instrumentId: voices.instrumentId })
          .from(userVoices)
          .innerJoin(voices, eq(voices.id, userVoices.voiceId))
          .where(inArray(userVoices.userId, [...userIds]))
          .orderBy(asc(userVoices.position))
      : [];
    return {
      memberships: (id: string) => memberRows.filter((m) => m.userId === id).map(({ ensemble, role }) => ({ ensemble, role })),
      voices: (id: string): VoiceRef[] => voiceRows.filter((v) => v.userId === id).map(({ id: vid, name, instrumentId }) => ({ id: vid, name, instrumentId })),
    };
  }
}

function toRow(u: UserRecord, extras: Awaited<ReturnType<UsersService['extras']>>): UserRow {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    pictureUrl: httpUrlOrNull(u.pictureUrl),
    memberships: extras.memberships(u.id),
    voices: extras.voices(u.id),
    status: u.status,
    isAdmin: u.isAdmin,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  };
}
