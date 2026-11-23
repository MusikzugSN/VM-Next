import { Inject, Injectable } from '@nestjs/common';
import type { CreateVoiceBody, CreateVoiceResponse, InstrumentSuggestionsResponse, VoiceListResponse } from '@vm-web/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { uuidv7 } from '../common/ids/uuid-v7';
import { ProblemException } from '../common/problem-details/problem.exception';
import { DATABASE, type Database } from '../db/database';
import { withNameTaken } from '../db/db-errors';
import { ensembleLineupVoices, instruments, sheets, uploads, userVoices, voices, voiceSubstitutes } from '../db/schema';
import { escapeLike, likePattern } from '../common/sql';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

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
      this.countBy(sql`select voice_id, count(*)::int as n from sheets group by voice_id`),
      this.countBy(sql`select voice_id, count(distinct ensemble_id)::int as n from ensemble_lineup_voices group by voice_id`),
    ]);

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
        sheetCount: sheetCounts.get(r.voice.id) ?? 0,
        lineupCount: lineupCounts.get(r.voice.id) ?? 0,
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
      .where(q ? sql`${instruments.name} ilike ${likePattern(q)}` : undefined)
      .orderBy(sql`(${instruments.name} ilike ${prefix}) desc`, asc(instruments.position))
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
      const unknown = substituteIds.map((id, i) => [id, i] as const).filter(([id]) => !found.has(id));
      if (unknown.length) throw ProblemException.validation(unknown.map(([, i]) => ({ path: `/body/substituteVoiceIds/${i}`, code: 'unknown_voice' })));
      await tx.delete(voiceSubstitutes).where(eq(voiceSubstitutes.voiceId, voiceId));
      if (substituteIds.length) {
        await tx.insert(voiceSubstitutes).values(substituteIds.map((substituteVoiceId, position) => ({ voiceId, substituteVoiceId, position })));
      }
    });
  }

  /** Only unused voices (sheets, lineups, profiles); empty instruments disappear too. */
  async delete(voiceId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [voice] = await tx.select().from(voices).where(eq(voices.id, voiceId));
      if (!voice) throw ProblemException.notFound();
      const [usage] = await tx.execute<{ used: boolean }>(sql`select
        exists (select 1 from ${sheets} where voice_id = ${voiceId}::uuid)
        or exists (select 1 from ${ensembleLineupVoices} where voice_id = ${voiceId}::uuid)
        or exists (select 1 from ${userVoices} where voice_id = ${voiceId}::uuid)
        or exists (select 1 from ${uploads} where voice_id = ${voiceId}::uuid and status = 'pending') as used`).then((r) => r.rows);
      if (usage?.used) throw ProblemException.conflict('in-use');
      await tx.delete(voices).where(eq(voices.id, voiceId));
      await removeInstrumentIfEmpty(tx, voice.instrumentId);
    });
  }

  async renameInstrument(instrumentId: string, name: string): Promise<void> {
    await withNameTaken(async () => {
      const [taken] = await this.db
        .select({ id: instruments.id })
        .from(instruments)
        .where(and(sql`lower(${instruments.name}) = lower(${name})`, sql`${instruments.id} <> ${instrumentId}::uuid`));
      if (taken) throw ProblemException.conflict('name-taken');
      const [row] = await this.db.update(instruments).set({ name }).where(eq(instruments.id, instrumentId)).returning({ id: instruments.id });
      if (!row) throw ProblemException.notFound();
    });
  }

  /** Every instrument exactly once (F-16). */
  async reorderInstruments(ids: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const current = (await tx.select({ id: instruments.id }).from(instruments)).map((r) => r.id);
      assertPermutation(current, ids);
      for (const [position, id] of ids.entries()) await tx.update(instruments).set({ position }).where(eq(instruments.id, id));
    });
  }

  /** Every voice of the instrument exactly once (F-16). */
  async reorderVoices(instrumentId: string, ids: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [instrument] = await tx.select({ id: instruments.id }).from(instruments).where(eq(instruments.id, instrumentId));
      if (!instrument) throw ProblemException.notFound();
      const current = (await tx.select({ id: voices.id }).from(voices).where(eq(voices.instrumentId, instrumentId))).map((r) => r.id);
      assertPermutation(current, ids);
      for (const [position, id] of ids.entries()) await tx.update(voices).set({ position }).where(eq(voices.id, id));
    });
  }

  /** Finds the instrument case-insensitively or creates it at the end (N-7). */
  private async instrumentFor(tx: Tx, name: string): Promise<{ id: string; created: boolean }> {
    const [existing] = await tx.select({ id: instruments.id }).from(instruments).where(sql`lower(${instruments.name}) = lower(${name})`);
    if (existing) return { id: existing.id, created: false };
    const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${instruments.position}) + 1, 0)::int` }).from(instruments);
    const id = uuidv7();
    await tx.insert(instruments).values({ id, name, position: next });
    return { id, created: true };
  }

  private async assertNameFree(tx: Tx, name: string, exceptId?: string): Promise<void> {
    const [taken] = await tx
      .select({ id: voices.id })
      .from(voices)
      .where(and(sql`lower(${voices.name}) = lower(${name})`, exceptId ? sql`${voices.id} <> ${exceptId}::uuid` : undefined));
    if (taken) throw ProblemException.conflict('name-taken');
  }

  private async countBy(query: ReturnType<typeof sql>): Promise<Map<string, number>> {
    const result = await this.db.execute<{ voice_id: string; n: number }>(query);
    return new Map(result.rows.map((r) => [r.voice_id, r.n]));
  }
}

async function nextVoicePosition(tx: Tx, instrumentId: string): Promise<number> {
  const [{ next }] = await tx
    .select({ next: sql<number>`coalesce(max(${voices.position}) + 1, 0)::int` })
    .from(voices)
    .where(eq(voices.instrumentId, instrumentId));
  return next;
}

async function removeInstrumentIfEmpty(tx: Tx, instrumentId: string): Promise<void> {
  await tx.execute(sql`delete from ${instruments} where id = ${instrumentId}::uuid and not exists (select 1 from ${voices} where instrument_id = ${instrumentId}::uuid)`);
}

function assertPermutation(current: readonly string[], given: readonly string[]): void {
  const ok = given.length === current.length && new Set(given).size === given.length && given.every((id) => current.includes(id));
  if (!ok) throw ProblemException.conflict('conflict', 'List incomplete or outdated');
}
