import { Inject, Injectable } from '@nestjs/common';
import type { CreateVoiceResponse } from '@vm-web/shared';
import { and, asc, count, countDistinct, eq, inArray, like, ne, sql } from 'drizzle-orm';
import { uuidv7 } from '../common/ids/uuid-v7';
import { ProblemException } from '../common/problem-details/problem.exception';
import { escapeLike, likePattern } from '../common/sql';
import { assertKnownIds } from '../common/validation/id-list';
import { DATABASE, type Database, type Tx } from '../db/database';
import { withNameTaken } from '../db/db-errors';
import { ensembleLineupVoices, instruments, seedLock, sheets, uploads, userVoices, voices, voiceSubstitutes } from '../db/schema';
import { assertPermutation, nextPosition, replaceRows } from '../db/table-helpers';

@Injectable()
export class VoicesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async catalog() {
    const [rows, substitutes, sheetCounts, lineupCounts] = await Promise.all([
      this.db
        .select({ instrument: { id: instruments.id, name: instruments.name }, voice: { id: voices.id, name: voices.name } })
        .from(instruments)
        .innerJoin(voices, eq(voices.instrumentId, instruments.id))
        .orderBy(asc(instruments.position), asc(voices.position)),
      this.db
        .select({ voiceId: voiceSubstitutes.voiceId, id: voices.id, name: voices.name, instrumentId: voices.instrumentId })
        .from(voiceSubstitutes)
        .innerJoin(voices, eq(voices.id, voiceSubstitutes.substituteVoiceId))
        .orderBy(asc(voiceSubstitutes.position)),
      this.db.select({ voiceId: sheets.voiceId, n: count() }).from(sheets).groupBy(sheets.voiceId),
      this.db
        .select({ voiceId: ensembleLineupVoices.voiceId, n: countDistinct(ensembleLineupVoices.ensembleId) })
        .from(ensembleLineupVoices)
        .groupBy(ensembleLineupVoices.voiceId),
    ]);
    return { rows, substitutes, sheetCounts, lineupCounts };
  }

  instrumentSuggestions(q: string, limit: number) {
    const prefix = `${escapeLike(q)}%`;
    return this.db
      .select({ id: instruments.id, name: instruments.name })
      .from(instruments)
      .where(q ? like(instruments.name, likePattern(q)) : undefined)
      .orderBy(sql`(${instruments.name} like ${prefix}) desc`, asc(instruments.position))
      .limit(limit);
  }

  createVoice(name: string, instrumentName: string): Promise<CreateVoiceResponse> {
    return withNameTaken(() =>
      this.db.transaction(async (tx) => {
        await lockCatalog(tx);
        await assertVoiceNameFree(tx, name);
        const { id: instrumentId, created } = await instrumentFor(tx, instrumentName);
        const id = uuidv7();
        await tx.insert(voices).values({ id, instrumentId, name, position: await nextVoicePosition(tx, instrumentId) });
        return { id, instrumentId, instrumentCreated: created };
      }),
    );
  }

  async updateVoice(voiceId: string, name: string, instrumentName: string): Promise<void> {
    await withNameTaken(() =>
      this.db.transaction(async (tx) => {
        await lockCatalog(tx);
        const [voice] = await tx.select().from(voices).where(eq(voices.id, voiceId)).for('update');
        if (!voice) throw ProblemException.notFound();
        await assertVoiceNameFree(tx, name, voiceId);
        const { id: instrumentId } = await instrumentFor(tx, instrumentName);
        const moved = instrumentId !== voice.instrumentId;
        await tx
          .update(voices)
          .set({ name, instrumentId, updatedAt: new Date(), ...(moved ? { position: await nextVoicePosition(tx, instrumentId) } : {}) })
          .where(eq(voices.id, voiceId));
        if (moved) await removeInstrumentIfEmpty(tx, voice.instrumentId);
      }),
    );
  }

  async replaceSubstitutes(voiceId: string, substituteIds: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await lockCatalog(tx);
      const found = new Set(
        (
          await tx
            .select({ id: voices.id })
            .from(voices)
            .where(inArray(voices.id, [voiceId, ...substituteIds]))
            .for('share')
        ).map((v) => v.id),
      );
      if (!found.has(voiceId)) throw ProblemException.notFound();
      assertKnownIds(substituteIds, found, '/body/substituteVoiceIds', 'unknown_voice');
      await replaceRows(tx, voiceSubstitutes, eq(voiceSubstitutes.voiceId, voiceId), substituteIds.map((substituteVoiceId, position) => ({ voiceId, substituteVoiceId, position })));
    });
  }

  async deleteUnusedVoice(voiceId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await lockCatalog(tx);
      const [voice] = await tx.select().from(voices).where(eq(voices.id, voiceId)).for('update');
      if (!voice) throw ProblemException.notFound();
      if (await voiceInUse(tx, voiceId)) throw ProblemException.conflict('in-use');
      await tx.delete(voices).where(eq(voices.id, voiceId));
      await removeInstrumentIfEmpty(tx, voice.instrumentId);
    });
  }

  async renameInstrument(instrumentId: string, name: string): Promise<void> {
    await withNameTaken(() =>
      this.db.transaction(async (tx) => {
        await lockCatalog(tx);
        const [taken] = await tx
          .select({ id: instruments.id })
          .from(instruments)
          .where(and(sql`lower(${instruments.name}) = lower(${name})`, ne(instruments.id, instrumentId)));
        if (taken) throw ProblemException.conflict('name-taken');
        const [result] = await tx.update(instruments).set({ name }).where(eq(instruments.id, instrumentId));
        if (!result.affectedRows) throw ProblemException.notFound();
      }),
    );
  }

  async reorderInstruments(ids: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const current = await lockCatalog(tx);
      assertPermutation(current, ids, 'List incomplete or outdated');
      for (const [position, id] of ids.entries()) await tx.update(instruments).set({ position }).where(eq(instruments.id, id));
    });
  }

  async reorderVoices(instrumentId: string, ids: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const instrumentIds = await lockCatalog(tx);
      if (!instrumentIds.includes(instrumentId)) throw ProblemException.notFound();
      const current = (await tx.select({ id: voices.id }).from(voices).where(eq(voices.instrumentId, instrumentId))).map((r) => r.id);
      assertPermutation(current, ids, 'List incomplete or outdated');
      for (const [position, id] of ids.entries()) await tx.update(voices).set({ position }).where(eq(voices.id, id));
    });
  }
}

async function lockCatalog(tx: Tx): Promise<string[]> {
  await tx.select({ id: seedLock.id }).from(seedLock).where(eq(seedLock.id, 1)).for('update');
  const rows = await tx.select({ id: instruments.id }).from(instruments);
  return rows.map((r) => r.id);
}

async function instrumentFor(tx: Tx, name: string): Promise<{ id: string; created: boolean }> {
  const [existing] = await tx.select({ id: instruments.id }).from(instruments).where(sql`lower(${instruments.name}) = lower(${name})`);
  if (existing) return { id: existing.id, created: false };
  const id = uuidv7();
  await tx.insert(instruments).values({ id, name, position: await nextPosition(tx, instruments.position) });
  return { id, created: true };
}

async function assertVoiceNameFree(tx: Tx, name: string, exceptId?: string): Promise<void> {
  const [taken] = await tx
    .select({ id: voices.id })
    .from(voices)
    .where(and(sql`lower(${voices.name}) = lower(${name})`, exceptId ? ne(voices.id, exceptId) : undefined));
  if (taken) throw ProblemException.conflict('name-taken');
}

async function voiceInUse(tx: Tx, voiceId: string): Promise<boolean> {
  const usages = await Promise.all([
    tx.select({ id: sheets.id }).from(sheets).where(eq(sheets.voiceId, voiceId)).limit(1).for('share'),
    tx.select({ id: ensembleLineupVoices.voiceId }).from(ensembleLineupVoices).where(eq(ensembleLineupVoices.voiceId, voiceId)).limit(1).for('share'),
    tx.select({ id: userVoices.voiceId }).from(userVoices).where(eq(userVoices.voiceId, voiceId)).limit(1).for('share'),
    tx
      .select({ id: uploads.id })
      .from(uploads)
      .where(and(eq(uploads.voiceId, voiceId), eq(uploads.status, 'pending')))
      .limit(1)
      .for('share'),
  ]);
  return usages.some((rows) => rows.length > 0);
}

function nextVoicePosition(tx: Tx, instrumentId: string): Promise<number> {
  return nextPosition(tx, voices.position, eq(voices.instrumentId, instrumentId));
}

async function removeInstrumentIfEmpty(tx: Tx, instrumentId: string): Promise<void> {
  await tx.delete(instruments).where(and(eq(instruments.id, instrumentId), sql`not exists (select 1 from ${voices} where instrument_id = ${instrumentId})`));
}
