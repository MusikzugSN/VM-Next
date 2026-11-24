import { Inject, Injectable } from '@nestjs/common';
import type { CreateVoiceBody, CreateVoiceResponse, InstrumentSuggestionsResponse, VoiceListResponse } from '@vm-web/shared';
import { and, asc, count, countDistinct, eq, inArray, like, ne, sql } from 'drizzle-orm';
import { uuidv7 } from '../common/ids/uuid-v7';
import { ProblemException } from '../common/problem-details/problem.exception';
import { DATABASE, type Database, type Tx } from '../db/database';
import { withNameTaken } from '../db/db-errors';
import { ensembleLineupVoices, instruments, sheets, uploads, userVoices, voices, voiceSubstitutes } from '../db/schema';
import { assertKnownIds } from '../common/validation/id-list';
import { assertPermutation, nextPosition, replaceRows } from '../db/table-helpers';
import { escapeLike, likePattern } from '../common/sql';

/** Voices and instruments: one list, instrument typed with autocomplete, ordered substitutes (N-6, N-7, N-9, F-16). */
@Injectable()
export class VoicesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(): Promise<VoiceListResponse> {
    const [rows, subs, sheetCounts, lineupCounts] = await Promise.all([
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
    const sheetCountMap = new Map(sheetCounts.map((s) => [s.voiceId, s.n]));
    const lineupCountMap = new Map(lineupCounts.map((l) => [l.voiceId, l.n]));

    const groups: VoiceListResponse['groups'] = [];
    for (const r of rows) {
      let group = groups.at(-1);
      if (group?.instrument.id !== r.instrument.id) {
        group = { instrument: { ...r.instrument, voiceCount: 0 }, voices: [] };
        groups.push(group);
      }
      group.instrument.voiceCount++;
      group.voices.push({
        ...r.voice,
        substitutes: subs.filter((s) => s.voiceId === r.voice.id).map(({ id, name, instrumentId }) => ({ id, name, instrumentId })),
        sheetCount: sheetCountMap.get(r.voice.id) ?? 0,
        lineupCount: lineupCountMap.get(r.voice.id) ?? 0,
      });
    }
    return { groups };
  }

  /** Max. 20 instruments, prefix matches first (N-7). */
  async instrumentSuggestions(q: string): Promise<InstrumentSuggestionsResponse> {
    const prefix = `${escapeLike(q)}%`;
    const items = await this.db
      .select({ id: instruments.id, name: instruments.name })
      .from(instruments)
      .where(q ? like(instruments.name, likePattern(q)) : undefined)
      .orderBy(sql`(${instruments.name} like ${prefix}) desc`, asc(instruments.position))
      .limit(20);
    return { items };
  }

  async create(body: CreateVoiceBody): Promise<CreateVoiceResponse> {
    return withNameTaken(() =>
      this.db.transaction(async (tx) => {
        await this.assertNameFree(tx, body.name);
        const { id: instrumentId, created } = await this.instrumentFor(tx, body.instrumentName);
        const id = uuidv7();
        await tx.insert(voices).values({ id, instrumentId, name: body.name, position: await nextVoicePosition(tx, instrumentId) });
        return { id, instrumentId, instrumentCreated: created };
      }),
    );
  }

  /** Name and instrument; a voice moved to another instrument goes to the end of that instrument. */
  async update(voiceId: string, body: CreateVoiceBody): Promise<void> {
    await withNameTaken(() =>
      this.db.transaction(async (tx) => {
        const [voice] = await tx.select().from(voices).where(eq(voices.id, voiceId));
        if (!voice) throw ProblemException.notFound();
        await this.assertNameFree(tx, body.name, voiceId);
        const { id: instrumentId } = await this.instrumentFor(tx, body.instrumentName);
        const moved = instrumentId !== voice.instrumentId;
        await tx
          .update(voices)
          .set({ name: body.name, instrumentId, updatedAt: new Date(), ...(moved ? { position: await nextVoicePosition(tx, instrumentId) } : {}) })
          .where(eq(voices.id, voiceId));
        if (moved) await removeInstrumentIfEmpty(tx, voice.instrumentId);
      }),
    );
  }

  /** Ordered, without the voice itself and without duplicates (N-9). */
  async setSubstitutes(voiceId: string, substituteIds: readonly string[]): Promise<void> {
    const errors = substituteIds.flatMap((id, i) =>
      id === voiceId ? [{ path: `/body/substituteVoiceIds/${i}`, code: 'self_reference' }] : substituteIds.indexOf(id) !== i ? [{ path: `/body/substituteVoiceIds/${i}`, code: 'duplicate' }] : [],
    );
    if (errors.length) throw ProblemException.validation(errors);
    await this.db.transaction(async (tx) => {
      const ids = [voiceId, ...substituteIds];
      const found = new Set((await tx.select({ id: voices.id }).from(voices).where(inArray(voices.id, ids))).map((v) => v.id));
      if (!found.has(voiceId)) throw ProblemException.notFound();
      assertKnownIds(substituteIds, found, '/body/substituteVoiceIds', 'unknown_voice');
      await replaceRows(tx, voiceSubstitutes, eq(voiceSubstitutes.voiceId, voiceId), substituteIds.map((substituteVoiceId, position) => ({ voiceId, substituteVoiceId, position })));
    });
  }

  /** Only unused voices (sheets, lineups, profiles); empty instruments disappear too. */
  async delete(voiceId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [voice] = await tx.select().from(voices).where(eq(voices.id, voiceId));
      if (!voice) throw ProblemException.notFound();
      const [usedInSheets, usedInLineup, usedInProfile, usedInPending] = await Promise.all([
        tx.select({ id: sheets.id }).from(sheets).where(eq(sheets.voiceId, voiceId)).limit(1),
        tx.select({ id: ensembleLineupVoices.voiceId }).from(ensembleLineupVoices).where(eq(ensembleLineupVoices.voiceId, voiceId)).limit(1),
        tx.select({ id: userVoices.voiceId }).from(userVoices).where(eq(userVoices.voiceId, voiceId)).limit(1),
        tx
          .select({ id: uploads.id })
          .from(uploads)
          .where(and(eq(uploads.voiceId, voiceId), eq(uploads.status, 'pending')))
          .limit(1),
      ]);
      if (usedInSheets.length || usedInLineup.length || usedInProfile.length || usedInPending.length) throw ProblemException.conflict('in-use');
      await tx.delete(voices).where(eq(voices.id, voiceId));
      await removeInstrumentIfEmpty(tx, voice.instrumentId);
    });
  }

  async renameInstrument(instrumentId: string, name: string): Promise<void> {
    await withNameTaken(async () => {
      const [taken] = await this.db
        .select({ id: instruments.id })
        .from(instruments)
        .where(and(sql`lower(${instruments.name}) = lower(${name})`, ne(instruments.id, instrumentId)));
      if (taken) throw ProblemException.conflict('name-taken');
      const [result] = await this.db.update(instruments).set({ name }).where(eq(instruments.id, instrumentId));
      if (!result.affectedRows) throw ProblemException.notFound();
    });
  }

  /** Every instrument exactly once (F-16). */
  async reorderInstruments(ids: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const current = (await tx.select({ id: instruments.id }).from(instruments)).map((r) => r.id);
      assertPermutation(current, ids, 'List incomplete or outdated');
      for (const [position, id] of ids.entries()) await tx.update(instruments).set({ position }).where(eq(instruments.id, id));
    });
  }

  /** Every voice of the instrument exactly once (F-16). */
  async reorderVoices(instrumentId: string, ids: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [instrument] = await tx.select({ id: instruments.id }).from(instruments).where(eq(instruments.id, instrumentId));
      if (!instrument) throw ProblemException.notFound();
      const current = (await tx.select({ id: voices.id }).from(voices).where(eq(voices.instrumentId, instrumentId))).map((r) => r.id);
      assertPermutation(current, ids, 'List incomplete or outdated');
      for (const [position, id] of ids.entries()) await tx.update(voices).set({ position }).where(eq(voices.id, id));
    });
  }

  /** Finds the instrument case-insensitively or creates it at the end (N-7). */
  private async instrumentFor(tx: Tx, name: string): Promise<{ id: string; created: boolean }> {
    const [existing] = await tx.select({ id: instruments.id }).from(instruments).where(sql`lower(${instruments.name}) = lower(${name})`);
    if (existing) return { id: existing.id, created: false };
    const id = uuidv7();
    await tx.insert(instruments).values({ id, name, position: await nextPosition(tx, instruments.position) });
    return { id, created: true };
  }

  private async assertNameFree(tx: Tx, name: string, exceptId?: string): Promise<void> {
    const [taken] = await tx
      .select({ id: voices.id })
      .from(voices)
      .where(and(sql`lower(${voices.name}) = lower(${name})`, exceptId ? ne(voices.id, exceptId) : undefined));
    if (taken) throw ProblemException.conflict('name-taken');
  }
}

function nextVoicePosition(tx: Tx, instrumentId: string): Promise<number> {
  return nextPosition(tx, voices.position, eq(voices.instrumentId, instrumentId));
}

async function removeInstrumentIfEmpty(tx: Tx, instrumentId: string): Promise<void> {
  await tx.delete(instruments).where(and(eq(instruments.id, instrumentId), sql`not exists (select 1 from ${voices} where instrument_id = ${instrumentId})`));
}
