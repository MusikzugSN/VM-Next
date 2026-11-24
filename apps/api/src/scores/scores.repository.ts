import { Inject, Injectable } from '@nestjs/common';
import type { CustomFieldType, EnsembleOption, ScoreFixedFields, VoiceRef } from '@vm-web/shared';
import { and, asc, count, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import { activeEnsembleOptions } from '../common/ensemble-tree';
import { DATABASE, type Database, type Tx } from '../db/database';
import {
  clubTags,
  ensembleLineupVoices,
  ensembles,
  fieldDefinitions,
  fieldOptions,
  folderEntries,
  folders,
  instruments,
  scoreClubTags,
  scoreFieldValues,
  scores,
  sheets,
  uploads,
  users,
  voices,
} from '../db/schema';
import type { FieldDef } from './custom-fields';
import type { SortPlan } from './score-query';
import { replaceRows } from '../db/table-helpers';
import { appendTo } from '../common/collections';

export type ScoreRow = typeof scores.$inferSelect & { customValues: Record<string, unknown> };

/** Queries of the library (N-1..N-5). Permission checks happen before, in guards and services. */
@Injectable()
export class ScoresRepository {
  constructor(@Inject(DATABASE) readonly db: Database) {}

  // --- custom field definitions -------------------------------------------------------------------------------

  async fields(): Promise<FieldDef[]> {
    const [defs, options] = await Promise.all([
      this.db.select().from(fieldDefinitions).orderBy(asc(fieldDefinitions.position), asc(fieldDefinitions.name)),
      this.db.select().from(fieldOptions).orderBy(asc(fieldOptions.position)),
    ]);
    return defs.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type as CustomFieldType,
      required: d.required,
      position: d.position,
      options: options.filter((o) => o.fieldId === d.id).map((o) => ({ id: o.id, label: o.label })),
    }));
  }

  async fieldNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: fieldDefinitions.id })
      .from(fieldDefinitions)
      .where(and(sql`lower(${fieldDefinitions.name}) = lower(${name})`, exceptId ? ne(fieldDefinitions.id, exceptId) : undefined));
    return !!row;
  }

  // --- scores -------------------------------------------------------------------------------------------------

  async scoreTable(where: SQL[], plan: SortPlan, limit: number) {
    const rows = await this.db
      .select({ score: scores, sortEmpty: plan.emptyFlag, sortValue: sql<string | number | boolean | null>`${plan.value}` })
      .from(scores)
      .where(and(...where))
      .orderBy(...plan.orderBy)
      .limit(limit);
    const customValues = await this.customValuesOf(rows.map((r) => r.score.id));
    return rows.map((r) => ({ ...r, score: { ...r.score, customValues: customValues.get(r.score.id) ?? {} } }));
  }

  async countScores(where: SQL[]): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(scores).where(and(...where));
    return row?.n ?? 0;
  }

  async score(id: string): Promise<ScoreRow | undefined> {
    const [row] = await this.db.select().from(scores).where(eq(scores.id, id));
    if (!row) return undefined;
    const customValues = await this.customValuesOf([id]);
    return { ...row, customValues: customValues.get(id) ?? {} };
  }

  /** Custom field values of the given scores, grouped by score id (N-2). */
  async customValuesOf(scoreIds: readonly string[]): Promise<Map<string, Record<string, unknown>>> {
    const result = new Map<string, Record<string, unknown>>();
    if (!scoreIds.length) return result;
    const rows = await this.db
      .select({ scoreId: scoreFieldValues.scoreId, fieldId: scoreFieldValues.fieldId, value: scoreFieldValues.value })
      .from(scoreFieldValues)
      .where(inArray(scoreFieldValues.scoreId, [...scoreIds]));
    for (const r of rows) {
      const obj = result.get(r.scoreId) ?? {};
      obj[r.fieldId] = r.value;
      result.set(r.scoreId, obj);
    }
    return result;
  }

  async tagsOf(scoreIds: readonly string[]): Promise<Map<string, { id: string; name: string }[]>> {
    const result = new Map<string, { id: string; name: string }[]>();
    if (!scoreIds.length) return result;
    const rows = await this.db
      .select({ scoreId: scoreClubTags.scoreId, id: clubTags.id, name: clubTags.name })
      .from(scoreClubTags)
      .innerJoin(clubTags, eq(clubTags.id, scoreClubTags.tagId))
      .where(inArray(scoreClubTags.scoreId, [...scoreIds]))
      .orderBy(sql`lower(${clubTags.name})`);
    for (const { scoreId, ...tag } of rows) appendTo(result, scoreId, tag);
    return result;
  }

  async existingTagIds(ids: readonly string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await this.db.select({ id: clubTags.id }).from(clubTags).where(inArray(clubTags.id, [...ids]));
    return new Set(rows.map((r) => r.id));
  }

  async insertScore(id: string, fixed: ScoreFixedFields, customValues: Record<string, unknown>, tagIds: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(scores).values({ id, ...fixed });
      await this.writeCustomValues(tx, id, customValues);
      if (tagIds.length) await tx.insert(scoreClubTags).values(tagIds.map((tagId) => ({ scoreId: id, tagId })));
    });
  }

  async updateScore(id: string, fixed: ScoreFixedFields, customValues: Record<string, unknown>, tagIds: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(scores).set({ ...fixed, updatedAt: new Date() }).where(eq(scores.id, id));
      await this.writeCustomValues(tx, id, customValues);
      await replaceRows(tx, scoreClubTags, eq(scoreClubTags.scoreId, id), tagIds.map((tagId) => ({ scoreId: id, tagId })));
    });
  }

  async writeCustomValues(tx: Tx, scoreId: string, values: Record<string, unknown>): Promise<void> {
    const rows = Object.entries(values).map(([fieldId, value]) => ({ scoreId, fieldId, value }));
    await replaceRows(tx, scoreFieldValues, eq(scoreFieldValues.scoreId, scoreId), rows);
  }

  /** Deletes the score with sheets and entries; returns the file keys to remove from storage. */
  async deleteScore(id: string): Promise<string[]> {
    return this.db.transaction(async (tx) => {
      const files = await tx.select({ key: sheets.fileKey }).from(sheets).where(eq(sheets.scoreId, id));
      await tx.delete(scores).where(eq(scores.id, id));
      return files.map((f) => f.key);
    });
  }

  // --- sheets -------------------------------------------------------------------------------------------------

  /** Sheets of a score ordered like the voice list; `uploadedBy` = person who uploaded the file. */
  async sheetsOfScore(scoreId: string) {
    return this.db
      .select({
        sheetId: sheets.id,
        voice: { id: voices.id, name: voices.name, instrumentId: voices.instrumentId },
        pageCount: sheets.pageCount,
        approvedAt: sheets.approvedAt,
        uploadedBy: { id: users.id, name: users.name },
      })
      .from(sheets)
      .innerJoin(voices, eq(voices.id, sheets.voiceId))
      .innerJoin(instruments, eq(instruments.id, voices.instrumentId))
      .leftJoin(uploads, eq(uploads.id, sheets.uploadId))
      .leftJoin(users, eq(users.id, uploads.uploadedBy))
      .where(eq(sheets.scoreId, scoreId))
      .orderBy(asc(instruments.position), asc(voices.position));
  }

  async pendingUploadCount(scoreId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(uploads)
      .where(and(eq(uploads.scoreId, scoreId), eq(uploads.status, 'pending')));
    return row?.n ?? 0;
  }

  async sheet(sheetId: string) {
    const [row] = await this.db
      .select({ id: sheets.id, fileKey: sheets.fileKey, title: scores.title, voiceName: voices.name })
      .from(sheets)
      .innerJoin(scores, eq(scores.id, sheets.scoreId))
      .innerJoin(voices, eq(voices.id, sheets.voiceId))
      .where(eq(sheets.id, sheetId));
    return row;
  }

  async deleteSheet(sheetId: string): Promise<string | undefined> {
    const [row] = await this.db.select({ key: sheets.fileKey }).from(sheets).where(eq(sheets.id, sheetId));
    if (!row) return undefined;
    await this.db.delete(sheets).where(eq(sheets.id, sheetId));
    return row.key;
  }

  /** `scoreId → voiceId → sheetId` for the given scores and voices. */
  async sheetIdsByVoice(scoreIds: readonly string[], voiceIds: readonly string[]): Promise<Map<string, Map<string, string>>> {
    const result = new Map<string, Map<string, string>>();
    if (!scoreIds.length || !voiceIds.length) return result;
    const rows = await this.db
      .select({ scoreId: sheets.scoreId, voiceId: sheets.voiceId, id: sheets.id })
      .from(sheets)
      .where(and(inArray(sheets.scoreId, [...scoreIds]), inArray(sheets.voiceId, [...voiceIds])));
    for (const r of rows) {
      const map = result.get(r.scoreId) ?? new Map<string, string>();
      map.set(r.voiceId, r.id);
      result.set(r.scoreId, map);
    }
    return result;
  }

  // --- lineup & ensembles (N-4) -------------------------------------------------------------------------------

  async ensembleRef(id: string): Promise<{ id: string; name: string } | undefined> {
    const [row] = await this.db.select({ id: ensembles.id, name: ensembles.name }).from(ensembles).where(eq(ensembles.id, id));
    return row;
  }

  async lineup(ensembleId: string): Promise<VoiceRef[]> {
    return this.db
      .select({ id: voices.id, name: voices.name, instrumentId: voices.instrumentId })
      .from(ensembleLineupVoices)
      .innerJoin(voices, eq(voices.id, ensembleLineupVoices.voiceId))
      .where(eq(ensembleLineupVoices.ensembleId, ensembleId))
      .orderBy(asc(ensembleLineupVoices.position));
  }

  /** Active ensembles with a lineup, in tree order (F-3). */
  async ensemblesWithLineup(): Promise<EnsembleOption[]> {
    const rows = await this.db
      .select({ id: ensembles.id })
      .from(ensembles)
      .where(sql`exists (select 1 from ensemble_lineup_voices lv where lv.ensemble_id = ${ensembles.id})`);
    return activeEnsembleOptions(this.db, rows.map((r) => r.id));
  }

  async allClubTags(): Promise<{ id: string; name: string }[]> {
    return this.db.select({ id: clubTags.id, name: clubTags.name }).from(clubTags).orderBy(sql`lower(${clubTags.name})`);
  }

  /** Folders containing the score, only in the given ensembles (N-5). */
  async foldersOfScore(scoreId: string, ensembleIds: readonly string[] | 'all') {
    if (ensembleIds !== 'all' && !ensembleIds.length) return [];
    return this.db
      .select({
        folder: { id: folders.id, name: folders.name },
        ensemble: { id: ensembles.id, name: ensembles.name },
        number: folderEntries.number,
      })
      .from(folderEntries)
      .innerJoin(folders, eq(folders.id, folderEntries.folderId))
      .innerJoin(ensembles, eq(ensembles.id, folders.ensembleId))
      .where(and(eq(folderEntries.scoreId, scoreId), ensembleIds === 'all' ? undefined : inArray(folders.ensembleId, [...ensembleIds])))
      .orderBy(sql`lower(${ensembles.name})`, sql`lower(${folders.name})`);
  }
}
