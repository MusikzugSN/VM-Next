import { Inject, Injectable } from '@nestjs/common';
import type {
  ApplyLineupTemplateResponse,
  CreateEnsembleBody,
  EnsembleDetailsResponse,
  EnsembleLineupResponse,
  EnsembleListItem,
  EnsembleListQuery,
  EnsembleMember,
  Page,
} from '@vm-web/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { uuidv7 } from '../common/ids/uuid-v7';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { httpUrlOrNull } from '../common/url';
import { DATABASE, type Database } from '../db/database';
import { isUniqueViolation } from '../db/db-errors';
import { clubSettings, ensembleLineupVoices, ensembles, memberships, roles, users, userVoices, voices } from '../db/schema';
import { likePattern } from '../me/me.repository';
import { lineupTemplateFile } from '../seed/defaults';
import { importLineupTemplate, loadLineupTemplate } from '../seed/lineup-template';
import { assertKnownIds, assertNoDuplicates } from '../common/validation/id-list';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type EnsembleRecord = typeof ensembles.$inferSelect;

/** Ensembles as a tree with lineup (S-2, F-3, N-4, N-8). */
@Injectable()
export class EnsemblesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** The whole tree in pre-order (parent before children, siblings by name); cursor = position. */
  async list(query: EnsembleListQuery): Promise<Page<EnsembleListItem>> {
    const tree = await this.tree(query.includeArchived);
    const start = query.cursor ? Number(decodeCursor(query.cursor, 1)?.[0]) : 0;
    const items = tree.slice(start, start + query.limit);
    const end = start + items.length;
    return { items, nextCursor: end < tree.length ? encodeCursor([end]) : null };
  }

  async details(ensembleId: string): Promise<EnsembleDetailsResponse> {
    const item = (await this.tree(true)).find((e) => e.id === ensembleId);
    if (!item) throw ProblemException.notFound();
    const record = await this.ensemble(ensembleId);
    return { ...item, createdAt: record.createdAt.toISOString(), archivedAt: record.archivedAt?.toISOString() ?? null };
  }

  async lineup(ensembleId: string): Promise<EnsembleLineupResponse> {
    await this.ensemble(ensembleId);
    const rows = await this.db
      .select({ id: voices.id, name: voices.name, instrumentId: voices.instrumentId })
      .from(ensembleLineupVoices)
      .innerJoin(voices, eq(voices.id, ensembleLineupVoices.voiceId))
      .where(eq(ensembleLineupVoices.ensembleId, ensembleId))
      .orderBy(asc(ensembleLineupVoices.position));
    return { voices: rows };
  }

  /** Direct members with role and profile voices (S-2; with `member.view` in the ensemble, R-3). */
  async members(ensembleId: string, query: { q?: string; cursor?: string; limit: number }): Promise<Page<EnsembleMember>> {
    await this.ensemble(ensembleId);
    const cursor = decodeCursor(query.cursor, 2);
    const rows = await this.db
      .select({
        userId: users.id,
        name: users.name,
        pictureUrl: users.pictureUrl,
        role: { id: roles.id, name: roles.name },
        sortKey: sql<string>`lower(${users.name})`,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(
          eq(memberships.ensembleId, ensembleId),
          query.q ? sql`${users.name} ilike ${likePattern(query.q)}` : undefined,
          cursor ? sql`(lower(${users.name}), ${users.id}) > (${cursor[0]}, ${cursor[1]}::uuid)` : undefined,
        ),
      )
      .orderBy(sql`lower(${users.name})`, asc(users.id))
      .limit(query.limit + 1);
    const page = rows.slice(0, query.limit);
    const voiceRows = page.length
      ? await this.db
          .select({ userId: userVoices.userId, id: voices.id, name: voices.name, instrumentId: voices.instrumentId })
          .from(userVoices)
          .innerJoin(voices, eq(voices.id, userVoices.voiceId))
          .where(inArray(userVoices.userId, page.map((r) => r.userId)))
          .orderBy(asc(userVoices.position))
      : [];
    const last = page.at(-1);
    return {
      items: page.map((r) => ({
        userId: r.userId,
        name: r.name,
        pictureUrl: httpUrlOrNull(r.pictureUrl),
        role: r.role,
        voices: voiceRows.filter((v) => v.userId === r.userId).map(({ id, name, instrumentId }) => ({ id, name, instrumentId })),
      })),
      nextCursor: rows.length > query.limit && last ? encodeCursor([last.sortKey, last.userId]) : null,
    };
  }

  async create(body: CreateEnsembleBody): Promise<{ id: string }> {
    const parent = await this.ensemble(body.parentId, 'Unknown parent');
    if (parent.archivedAt) throw ProblemException.validation([{ path: '/body/parentId', code: 'archived' }]);
    const template = body.applyLineupTemplate ? await loadLineupTemplate(lineupTemplateFile()) : undefined;
    const id = uuidv7();
    await this.unique(() =>
      this.db.transaction(async (tx) => {
        await tx.insert(ensembles).values({ id, parentId: body.parentId, name: body.name });
        if (template) await setLineup(tx, id, (await importLineupTemplate(tx, template)).lineupVoiceIds);
      }),
    );
    return { id };
  }

  /** The root may be renamed too (H-4). Names are unique among siblings. */
  async rename(ensembleId: string, name: string): Promise<void> {
    await this.ensemble(ensembleId);
    await this.unique(() => this.db.update(ensembles).set({ name, updatedAt: new Date() }).where(eq(ensembles.id, ensembleId)));
  }

  /** Moves an ensemble in the tree (F-3); never the root, never below itself. */
  async setParent(ensembleId: string, parentId: string): Promise<void> {
    const ensemble = await this.ensemble(ensembleId);
    if (ensemble.isRoot) throw ProblemException.conflict('root-ensemble');
    await this.ensemble(parentId, 'Unknown parent');
    const all = await this.db.select({ id: ensembles.id, parentId: ensembles.parentId }).from(ensembles);
    if (descendantsOf(ensembleId, all).has(parentId) || parentId === ensembleId) throw ProblemException.conflict('invalid-hierarchy');
    await this.unique(() => this.db.update(ensembles).set({ parentId, updatedAt: new Date() }).where(eq(ensembles.id, ensembleId)));
  }

  /** Not the root, not the default ensemble, not with active sub-ensembles (S-2). */
  async archive(ensembleId: string): Promise<void> {
    const ensemble = await this.ensemble(ensembleId);
    if (ensemble.isRoot) throw ProblemException.conflict('root-ensemble');
    const [settings] = await this.db.select({ defaultEnsembleId: clubSettings.defaultEnsembleId }).from(clubSettings);
    if (settings?.defaultEnsembleId === ensembleId) throw ProblemException.conflict('in-use', 'Default ensemble');
    const [child] = await this.db
      .select({ id: ensembles.id })
      .from(ensembles)
      .where(and(eq(ensembles.parentId, ensembleId), sql`${ensembles.archivedAt} is null`));
    if (child) throw ProblemException.conflict('in-use', 'Ensemble has active sub-ensembles');
    await this.db.update(ensembles).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(ensembles.id, ensembleId));
  }

  async unarchive(ensembleId: string): Promise<void> {
    const ensemble = await this.ensemble(ensembleId);
    if (ensemble.parentId) {
      const parent = await this.ensemble(ensemble.parentId);
      if (parent.archivedAt) throw ProblemException.conflict('conflict', 'Parent ensemble is archived');
    }
    await this.db.update(ensembles).set({ archivedAt: null, updatedAt: new Date() }).where(eq(ensembles.id, ensembleId));
  }

  /** Ordered voice list for completeness (N-4). */
  async setLineup(ensembleId: string, voiceIds: readonly string[]): Promise<void> {
    await this.ensemble(ensembleId);
    assertNoDuplicates(voiceIds, '/body/voiceIds');
    const found = new Set(
      voiceIds.length ? (await this.db.select({ id: voices.id }).from(voices).where(inArray(voices.id, [...voiceIds]))).map((v) => v.id) : [],
    );
    assertKnownIds(voiceIds, found, '/body/voiceIds', 'unknown_voice');
    await this.db.transaction((tx) => setLineup(tx, ensembleId, voiceIds));
  }

  /** Re-applies the shipped lineup template (N-8): creates missing voices and replaces the lineup. */
  async applyLineupTemplate(ensembleId: string): Promise<ApplyLineupTemplateResponse> {
    await this.ensemble(ensembleId);
    const template = await loadLineupTemplate(lineupTemplateFile());
    return this.db.transaction(async (tx) => {
      const result = await importLineupTemplate(tx, template);
      await setLineup(tx, ensembleId, result.lineupVoiceIds);
      return { createdInstruments: result.createdInstruments, createdVoices: result.createdVoices, lineupSize: result.lineupVoiceIds.length };
    });
  }

  private async tree(includeArchived: boolean): Promise<EnsembleListItem[]> {
    const [rows, [settings]] = await Promise.all([
      this.db
        .select({
          id: ensembles.id,
          name: ensembles.name,
          parentId: ensembles.parentId,
          isRoot: ensembles.isRoot,
          archivedAt: ensembles.archivedAt,
          memberCount: sql<number>`(select count(*)::int from memberships m where m.ensemble_id = ${ensembles.id})`,
          lineupSize: sql<number>`(select count(*)::int from ensemble_lineup_voices l where l.ensemble_id = ${ensembles.id})`,
        })
        .from(ensembles),
      this.db.select({ defaultEnsembleId: clubSettings.defaultEnsembleId }).from(clubSettings),
    ]);
    const byParent = new Map<string | null, typeof rows>();
    for (const r of rows) byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r]);
    const result: EnsembleListItem[] = [];
    const walk = (parentId: string | null, depth: number) => {
      const children = (byParent.get(parentId) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'de'));
      for (const e of children) {
        if (e.archivedAt && !includeArchived) continue;
        result.push({
          id: e.id,
          name: e.name,
          parentId: e.parentId,
          depth,
          isRoot: e.isRoot,
          archived: !!e.archivedAt,
          isDefault: settings?.defaultEnsembleId === e.id,
          memberCount: e.memberCount,
          lineupSize: e.lineupSize,
        });
        walk(e.id, depth + 1);
      }
    };
    walk(null, 0);
    return result;
  }

  private async ensemble(id: string, detail?: string): Promise<EnsembleRecord> {
    const [row] = await this.db.select().from(ensembles).where(eq(ensembles.id, id));
    if (!row) throw ProblemException.notFound(detail);
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

async function setLineup(tx: Tx, ensembleId: string, voiceIds: readonly string[]): Promise<void> {
  await tx.delete(ensembleLineupVoices).where(eq(ensembleLineupVoices.ensembleId, ensembleId));
  if (voiceIds.length) await tx.insert(ensembleLineupVoices).values(voiceIds.map((voiceId, position) => ({ ensembleId, voiceId, position })));
}

/** All descendants of an ensemble (not including itself). */
export function descendantsOf(id: string, all: readonly { id: string; parentId: string | null }[]): Set<string> {
  const result = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop() as string;
    for (const e of all) {
      if (e.parentId === current && !result.has(e.id)) {
        result.add(e.id);
        stack.push(e.id);
      }
    }
  }
  return result;
}
