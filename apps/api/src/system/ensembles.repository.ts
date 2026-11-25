import { Inject, Injectable } from '@nestjs/common';
import type { EnsembleOption, VoiceRef } from '@vm-web/shared';
import { and, asc, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import { activeEnsembleOptions } from '../common/ensemble-tree';
import type { CursorKey } from '../common/pagination/cursor';
import { afterNameAndId } from '../common/pagination/keyset';
import { likePattern } from '../common/sql';
import { DATABASE, type Database, type Tx } from '../db/database';
import { clubSettings, ensembleLineupVoices, ensembles, memberships, roles, users, userVoices, voices } from '../db/schema';
import { replaceRows } from '../db/table-helpers';
import { importLineupTemplate, type LineupTemplate } from '../seed/lineup-template';
import { lockClubSettings } from './club-settings-lock';

export type EnsembleRecord = typeof ensembles.$inferSelect;
export type EnsembleNode = Pick<EnsembleRecord, 'id' | 'parentId' | 'isRoot'>;

export interface EnsembleTreeRow {
  id: string;
  name: string;
  parentId: string | null;
  isRoot: boolean;
  archivedAt: Date | null;
  memberCount: number;
  lineupSize: number;
}

export interface MemberRow {
  userId: string;
  name: string;
  pictureUrl: string | null;
  role: { id: string; name: string };
  sortKey: string;
}

export interface ArchiveState {
  ensemble: EnsembleRecord | undefined;
  isDefault: boolean;
  hasActiveChildren: boolean;
}

export interface UnarchiveState {
  ensemble: EnsembleRecord | undefined;
  parent: EnsembleRecord | undefined;
}

export interface LineupTemplateResult {
  createdInstruments: number;
  createdVoices: number;
  lineupSize: number;
}

@Injectable()
export class EnsemblesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async find(id: string): Promise<EnsembleRecord | undefined> {
    const [row] = await this.db.select().from(ensembles).where(eq(ensembles.id, id));
    return row;
  }

  treeRows(): Promise<EnsembleTreeRow[]> {
    return this.db
      .select({
        id: ensembles.id,
        name: ensembles.name,
        parentId: ensembles.parentId,
        isRoot: ensembles.isRoot,
        archivedAt: ensembles.archivedAt,
        memberCount: sql<number>`(select count(*) from memberships m where m.ensemble_id = ${ensembles.id})`,
        lineupSize: sql<number>`(select count(*) from ensemble_lineup_voices l where l.ensemble_id = ${ensembles.id})`,
      })
      .from(ensembles);
  }

  async defaultEnsembleId(): Promise<string | null> {
    const [settings] = await this.db.select({ defaultEnsembleId: clubSettings.defaultEnsembleId }).from(clubSettings);
    return settings?.defaultEnsembleId ?? null;
  }

  activeOptions(): Promise<EnsembleOption[]> {
    return activeEnsembleOptions(this.db);
  }

  lineup(ensembleId: string): Promise<VoiceRef[]> {
    return this.db
      .select({ id: voices.id, name: voices.name, instrumentId: voices.instrumentId })
      .from(ensembleLineupVoices)
      .innerJoin(voices, eq(voices.id, ensembleLineupVoices.voiceId))
      .where(eq(ensembleLineupVoices.ensembleId, ensembleId))
      .orderBy(asc(ensembleLineupVoices.position));
  }

  members(ensembleId: string, q: string | undefined, cursor: CursorKey | undefined, limit: number): Promise<MemberRow[]> {
    return this.db
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
      .where(and(eq(memberships.ensembleId, ensembleId), q ? like(users.name, likePattern(q)) : undefined, afterNameAndId(users.name, users.id, cursor)))
      .orderBy(sql`lower(${users.name})`, asc(users.id))
      .limit(limit + 1);
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

  async existingVoiceIds(voiceIds: readonly string[]): Promise<Set<string>> {
    if (!voiceIds.length) return new Set();
    const rows = await this.db.select({ id: voices.id }).from(voices).where(inArray(voices.id, [...voiceIds]));
    return new Set(rows.map((v) => v.id));
  }

  create(
    ensemble: { id: string; parentId: string; name: string },
    template: LineupTemplate | undefined,
    checkParent: (parent: EnsembleRecord | undefined) => void,
  ): Promise<void> {
    return this.db.transaction(async (tx) => {
      await lockClubSettings(tx);
      checkParent(await lockedEnsemble(tx, ensemble.parentId));
      await tx.insert(ensembles).values(ensemble);
      if (template) await writeLineup(tx, ensemble.id, (await importLineupTemplate(tx, template)).lineupVoiceIds);
    });
  }

  async rename(ensembleId: string, name: string): Promise<void> {
    await this.db.update(ensembles).set({ name, updatedAt: new Date() }).where(eq(ensembles.id, ensembleId));
  }

  move(ensembleId: string, parentId: string, checkTree: (tree: readonly EnsembleNode[]) => void): Promise<void> {
    return this.db.transaction(async (tx) => {
      await lockClubSettings(tx);
      checkTree(await tx.select({ id: ensembles.id, parentId: ensembles.parentId, isRoot: ensembles.isRoot }).from(ensembles).for('share'));
      await tx.update(ensembles).set({ parentId, updatedAt: new Date() }).where(eq(ensembles.id, ensembleId));
    });
  }

  archive(ensembleId: string, check: (state: ArchiveState) => void): Promise<void> {
    return this.db.transaction(async (tx) => {
      const settings = await lockClubSettings(tx);
      const ensemble = await lockedEnsemble(tx, ensembleId);
      const [child] = await tx
        .select({ id: ensembles.id })
        .from(ensembles)
        .where(and(eq(ensembles.parentId, ensembleId), isNull(ensembles.archivedAt)))
        .for('share');
      check({ ensemble, isDefault: settings.defaultEnsembleId === ensembleId, hasActiveChildren: !!child });
      await tx.update(ensembles).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(ensembles.id, ensembleId));
    });
  }

  unarchive(ensembleId: string, check: (state: UnarchiveState) => void): Promise<void> {
    return this.db.transaction(async (tx) => {
      await lockClubSettings(tx);
      const ensemble = await lockedEnsemble(tx, ensembleId);
      const parent = ensemble?.parentId ? await lockedEnsemble(tx, ensemble.parentId) : undefined;
      check({ ensemble, parent });
      await tx.update(ensembles).set({ archivedAt: null, updatedAt: new Date() }).where(eq(ensembles.id, ensembleId));
    });
  }

  setLineup(ensembleId: string, voiceIds: readonly string[]): Promise<void> {
    return this.db.transaction((tx) => writeLineup(tx, ensembleId, voiceIds));
  }

  applyLineupTemplate(ensembleId: string, template: LineupTemplate): Promise<LineupTemplateResult> {
    return this.db.transaction(async (tx) => {
      const result = await importLineupTemplate(tx, template);
      await writeLineup(tx, ensembleId, result.lineupVoiceIds);
      return { createdInstruments: result.createdInstruments, createdVoices: result.createdVoices, lineupSize: result.lineupVoiceIds.length };
    });
  }
}

async function lockedEnsemble(tx: Tx, id: string): Promise<EnsembleRecord | undefined> {
  const [row] = await tx.select().from(ensembles).where(eq(ensembles.id, id)).for('share');
  return row;
}

async function writeLineup(tx: Tx, ensembleId: string, voiceIds: readonly string[]): Promise<void> {
  await replaceRows(tx, ensembleLineupVoices, eq(ensembleLineupVoices.ensembleId, ensembleId), voiceIds.map((voiceId, position) => ({ ensembleId, voiceId, position })));
}
