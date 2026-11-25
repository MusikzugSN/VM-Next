import { Inject, Injectable } from '@nestjs/common';
import type { VoiceRef } from '@vm-web/shared';
import { and, asc, desc, eq, gte, inArray, isNull, like, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import type { MySqlColumn } from 'drizzle-orm/mysql-core';
import type { CursorKey } from '../common/pagination/cursor';
import { DATABASE, type Database } from '../db/database';
import {
  clubTags,
  ensembles,
  events,
  folderEntries,
  folders,
  instruments,
  personalTags,
  scoreClubTags,
  scorePersonalTags,
  scores,
  setlistEntries,
  sheets,
  uploads,
  userVoices,
  voices,
  voiceSubstitutes,
} from '../db/schema';
import type { SheetRow } from './sheet-resolution';
import { afterNameAndId } from '../common/pagination/keyset';
import { replaceRows } from '../db/table-helpers';
import { appendTo } from '../common/collections';
import { hasClubTag, likePattern } from '../common/sql';
import { displayFolderNumber } from '../folders/folder-number';

/** `( $1, $2, … )` for `in` lists; callers guarantee a non-empty list. */
const list = (ids: readonly string[]): SQL => sql`(${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;

function releasedInMyArea(table: { ensembleId: MySqlColumn; showInMyArea: MySqlColumn }, ensembleIds: readonly string[]): SQL | undefined {
  return and(inArray(table.ensembleId, [...ensembleIds]), eq(table.showInMyArea, true), isNull(ensembles.archivedAt));
}

/** Score ids reachable through released folders and events of the given ensembles (R-2, N-15, F-6). */
function visibleScoreIds(ensembleIds: readonly string[]): SQL {
  return sql`(
    select fe.score_id from folder_entries fe
      join folders f on f.id = fe.folder_id
      join ensembles e on e.id = f.ensemble_id
     where f.show_in_my_area and e.archived_at is null and f.ensemble_id in ${list(ensembleIds)}
    union
    select se.score_id from setlist_entries se
      join events ev on ev.id = se.event_id
      join ensembles e on e.id = ev.ensemble_id
     where ev.show_in_my_area and e.archived_at is null and ev.ensemble_id in ${list(ensembleIds)}
  )`;
}

export interface EventRow {
  id: string;
  name: string;
  date: string;
  ensembleId: string;
  ensembleName: string;
  scoreCount: number;
}

export interface FolderRow {
  id: string;
  name: string;
  ensembleId: string;
  ensembleName: string;
  scoreCount: number;
}

export interface ScoreListRow {
  scoreId: string;
  title: string;
  composer: string | null;
  /** Folder number, `null` outside folders. */
  number: string | null;
  /** Sort key of the row for the cursor. */
  sortKey: string | number;
}

export interface ScoreFilter {
  q?: string;
  clubTagId?: string;
  personalTag?: { userId: string; tagId: string };
}

const scoreCountOfFolder = sql<number>`(select count(*) from folder_entries x where x.folder_id = ${folders.id})`;
const scoreCountOfEvent = sql<number>`(select count(*) from setlist_entries x where x.event_id = ${events.id})`;

/** Read queries of Mein Bereich. Every method is scoped to the caller's member ensembles. */
const eventColumns = {
  id: events.id,
  name: events.name,
  date: events.date,
  ensembleId: ensembles.id,
  ensembleName: ensembles.name,
  scoreCount: scoreCountOfEvent,
};

const folderColumns = {
  id: folders.id,
  name: folders.name,
  ensembleId: ensembles.id,
  ensembleName: ensembles.name,
  scoreCount: scoreCountOfFolder,
};

@Injectable()
export class MeRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Sub-select of score ids visible in Mein Bereich for the given ensembles (non-empty list). */
  visibleScoreIdsSql(ensembleIds: readonly string[]): SQL {
    return visibleScoreIds(ensembleIds);
  }

  // --- uploads of the caller (N-14) ---------------------------------------------------------------------------

  async uploadSummary(userId: string, since: Date) {
    const [row] = await this.db
      .select({
        pending: sql<number | null>`sum(case when ${uploads.status} = 'pending' then 1 else 0 end)`,
        rejected: sql<number | null>`sum(case when ${uploads.status} = 'rejected' and ${uploads.decidedAt} >= ${since} then 1 else 0 end)`,
        approved: sql<number | null>`sum(case when ${uploads.status} = 'approved' and ${uploads.decidedAt} >= ${since} then 1 else 0 end)`,
      })
      .from(uploads)
      .where(eq(uploads.uploadedBy, userId));
    // sum() comes back from the driver as a string, not a number.
    return { pending: Number(row?.pending ?? 0), recentlyRejected: Number(row?.rejected ?? 0), recentlyApproved: Number(row?.approved ?? 0) };
  }

  async myUploads(userId: string, status: 'pending' | 'approved' | 'rejected' | undefined, cursor: CursorKey | undefined, limit: number) {
    return this.db
      .select({
        id: uploads.id,
        fileName: uploads.fileName,
        uploadedAt: uploads.createdAt,
        status: uploads.status,
        score: { id: scores.id, name: scores.title },
        voice: { id: voices.id, name: voices.name },
        rejectionReason: uploads.rejectionReason,
        decidedAt: uploads.decidedAt,
      })
      .from(uploads)
      .leftJoin(scores, eq(scores.id, uploads.scoreId))
      .leftJoin(voices, eq(voices.id, uploads.voiceId))
      .where(
        and(
          eq(uploads.uploadedBy, userId),
          status ? eq(uploads.status, status) : undefined,
          cursor ? sql`(${uploads.createdAt}, ${uploads.id}) < (${cursor[0]}, ${cursor[1]})` : undefined,
        ),
      )
      .orderBy(desc(uploads.createdAt), desc(uploads.id))
      .limit(limit + 1);
  }

  // --- voices -------------------------------------------------------------------------------------------------

  async profileVoices(userId: string): Promise<VoiceRef[]> {
    return this.db
      .select({ id: voices.id, name: voices.name, instrumentId: voices.instrumentId })
      .from(userVoices)
      .innerJoin(voices, eq(voices.id, userVoices.voiceId))
      .where(eq(userVoices.userId, userId))
      .orderBy(asc(userVoices.position));
  }

  async voicesByIds(ids: readonly string[]): Promise<VoiceRef[]> {
    if (!ids.length) return [];
    return this.db
      .select({ id: voices.id, name: voices.name, instrumentId: voices.instrumentId })
      .from(voices)
      .where(inArray(voices.id, [...ids]));
  }

  /** Ordered substitutes per voice (N-9). */
  async substitutesOf(voiceIds: readonly string[]): Promise<Map<string, VoiceRef[]>> {
    const result = new Map<string, VoiceRef[]>();
    if (!voiceIds.length) return result;
    const rows = await this.db
      .select({
        voiceId: voiceSubstitutes.voiceId,
        id: voices.id,
        name: voices.name,
        instrumentId: voices.instrumentId,
      })
      .from(voiceSubstitutes)
      .innerJoin(voices, eq(voices.id, voiceSubstitutes.substituteVoiceId))
      .where(inArray(voiceSubstitutes.voiceId, [...voiceIds]))
      .orderBy(asc(voiceSubstitutes.voiceId), asc(voiceSubstitutes.position));
    for (const { voiceId, ...ref } of rows) appendTo(result, voiceId, ref);
    return result;
  }

  /** All voices grouped by instrument in manual order (N-6, F-16). */
  async voiceGroups() {
    const rows = await this.db
      .select({
        instrumentId: instruments.id,
        instrumentName: instruments.name,
        voiceId: voices.id,
        voiceName: voices.name,
      })
      .from(instruments)
      .innerJoin(voices, eq(voices.instrumentId, instruments.id))
      .orderBy(asc(instruments.position), asc(instruments.name), asc(voices.position), asc(voices.name));
    const groups: { instrument: { id: string; name: string }; voices: { id: string; name: string }[] }[] = [];
    for (const r of rows) {
      let group = groups.at(-1);
      if (group?.instrument.id !== r.instrumentId) {
        group = { instrument: { id: r.instrumentId, name: r.instrumentName }, voices: [] };
        groups.push(group);
      }
      group.voices.push({ id: r.voiceId, name: r.voiceName });
    }
    return groups;
  }

  async replaceProfileVoices(userId: string, voiceIds: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await replaceRows(tx, userVoices, eq(userVoices.userId, userId), voiceIds.map((voiceId, position) => ({ userId, voiceId, position })));
    });
  }

  /** Approved sheets of the given scores in the given voices. */
  async sheetsFor(scoreIds: readonly string[], voiceIds: readonly string[]): Promise<Map<string, SheetRow[]>> {
    const result = new Map<string, SheetRow[]>();
    if (!scoreIds.length || !voiceIds.length) return result;
    const rows = await this.db
      .select({ scoreId: sheets.scoreId, sheetId: sheets.id, voiceId: sheets.voiceId, pageCount: sheets.pageCount })
      .from(sheets)
      .where(and(inArray(sheets.scoreId, [...scoreIds]), inArray(sheets.voiceId, [...voiceIds])));
    for (const { scoreId, ...sheet } of rows) appendTo(result, scoreId, sheet);
    return result;
  }

  // --- events (M-5) -------------------------------------------------------------------------------------------

  async events(
    ensembleIds: readonly string[],
    period: 'upcoming' | 'archived',
    today: string,
    cursor: CursorKey | undefined,
    limit: number,
  ): Promise<EventRow[]> {
    if (!ensembleIds.length) return [];
    const upcoming = period === 'upcoming';
    const after = cursor
      ? upcoming
        ? sql`(${events.date}, ${events.id}) > (${cursor[0]}, ${cursor[1]})`
        : sql`(${events.date}, ${events.id}) < (${cursor[0]}, ${cursor[1]})`
      : undefined;
    return this.db
      .select(eventColumns)
      .from(events)
      .innerJoin(ensembles, eq(ensembles.id, events.ensembleId))
      .where(
        and(
          releasedInMyArea(events, ensembleIds),
          upcoming ? gte(events.date, today) : lt(events.date, today),
          after,
        ),
      )
      .orderBy(...(upcoming ? [asc(events.date), asc(events.id)] : [desc(events.date), desc(events.id)]))
      .limit(limit + 1);
  }

  async event(ensembleIds: readonly string[], eventId: string): Promise<EventRow | undefined> {
    if (!ensembleIds.length) return undefined;
    const [row] = await this.db
      .select(eventColumns)
      .from(events)
      .innerJoin(ensembles, eq(ensembles.id, events.ensembleId))
      .where(
        and(eq(events.id, eventId), releasedInMyArea(events, ensembleIds)),
      );
    return row;
  }

  async setlist(eventId: string, cursor: CursorKey | undefined, limit: number): Promise<(ScoreListRow & { position: number })[]> {
    const rows = await this.db
      .select({
        scoreId: scores.id,
        title: scores.title,
        composer: scores.composer,
        position: setlistEntries.position,
      })
      .from(setlistEntries)
      .innerJoin(scores, eq(scores.id, setlistEntries.scoreId))
      .where(and(eq(setlistEntries.eventId, eventId), cursor ? sql`${setlistEntries.position} > ${cursor[0]}` : undefined))
      .orderBy(asc(setlistEntries.position))
      .limit(limit + 1);
    return rows.map((r) => ({ ...r, number: null, sortKey: r.position }));
  }

  async eventScoreIds(eventId: string): Promise<string[]> {
    const rows = await this.db.select({ id: setlistEntries.scoreId }).from(setlistEntries).where(eq(setlistEntries.eventId, eventId));
    return rows.map((r) => r.id);
  }

  // --- folders (M-4) ------------------------------------------------------------------------------------------

  async folders(
    ensembleIds: readonly string[],
    cursor: CursorKey | undefined,
    limit: number,
  ): Promise<(FolderRow & { sortEnsemble: string; sortName: string })[]> {
    if (!ensembleIds.length) return [];
    return this.db
      .select({
        ...folderColumns,
        sortEnsemble: sql<string>`lower(${ensembles.name})`,
        sortName: sql<string>`lower(${folders.name})`,
      })
      .from(folders)
      .innerJoin(ensembles, eq(ensembles.id, folders.ensembleId))
      .where(
        and(
          releasedInMyArea(folders, ensembleIds),
          cursor
            ? sql`(lower(${ensembles.name}), lower(${folders.name}), ${folders.id}) > (${cursor[0]}, ${cursor[1]}, ${cursor[2]})`
            : undefined,
        ),
      )
      .orderBy(sql`lower(${ensembles.name})`, sql`lower(${folders.name})`, asc(folders.id))
      .limit(limit + 1);
  }

  async folder(ensembleIds: readonly string[], folderId: string): Promise<FolderRow | undefined> {
    if (!ensembleIds.length) return undefined;
    const [row] = await this.db
      .select(folderColumns)
      .from(folders)
      .innerJoin(ensembles, eq(ensembles.id, folders.ensembleId))
      .where(
        and(eq(folders.id, folderId), releasedInMyArea(folders, ensembleIds)),
      );
    return row;
  }

  async folderScores(folderId: string, filter: ScoreFilter, cursor: CursorKey | undefined, limit: number): Promise<ScoreListRow[]> {
    const rows = await this.db
      .select({
        scoreId: scores.id,
        title: scores.title,
        composer: scores.composer,
        number: displayFolderNumber,
        sortKey: folderEntries.numberSortKey,
      })
      .from(folderEntries)
      .innerJoin(scores, eq(scores.id, folderEntries.scoreId))
      .where(
        and(
          eq(folderEntries.folderId, folderId),
          ...this.scoreFilter(filter),
          cursor ? sql`(${folderEntries.numberSortKey}, ${scores.id}) > (${cursor[0]}, ${cursor[1]})` : undefined,
        ),
      )
      .orderBy(asc(folderEntries.numberSortKey), asc(scores.id))
      .limit(limit + 1);
    return rows;
  }

  async folderNumber(folderId: string, scoreId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ number: displayFolderNumber })
      .from(folderEntries)
      .where(and(eq(folderEntries.folderId, folderId), eq(folderEntries.scoreId, scoreId)));
    return row?.number ?? null;
  }

  async folderScoreIds(folderId: string): Promise<string[]> {
    const rows = await this.db.select({ id: folderEntries.scoreId }).from(folderEntries).where(eq(folderEntries.folderId, folderId));
    return rows.map((r) => r.id);
  }

  // --- tags (M-8) ---------------------------------------------------------------------------------------------

  async tagsWithCounts(userId: string, ensembleIds: readonly string[]) {
    const visible = ensembleIds.length ? visibleScoreIds(ensembleIds) : sql`(select null where false)`;
    const [club, personal] = await Promise.all([
      this.db
        .select({
          id: clubTags.id,
          name: clubTags.name,
          scoreCount: sql<number>`(select count(*) from score_club_tags x where x.tag_id = ${clubTags.id} and x.score_id in ${visible})`,
        })
        .from(clubTags)
        .orderBy(sql`lower(${clubTags.name})`),
      this.db
        .select({
          id: personalTags.id,
          name: personalTags.name,
          scoreCount: sql<number>`(select count(*) from score_personal_tags x where x.personal_tag_id = ${personalTags.id} and x.score_id in ${visible})`,
        })
        .from(personalTags)
        .where(eq(personalTags.userId, userId))
        .orderBy(sql`lower(${personalTags.name})`),
    ]);
    return { club, personal };
  }

  async clubTagExists(tagId: string): Promise<boolean> {
    const [row] = await this.db.select({ id: clubTags.id }).from(clubTags).where(eq(clubTags.id, tagId));
    return !!row;
  }

  async personalTagOf(userId: string, tagId: string): Promise<{ id: string; name: string } | undefined> {
    const [row] = await this.db
      .select({ id: personalTags.id, name: personalTags.name })
      .from(personalTags)
      .where(and(eq(personalTags.id, tagId), eq(personalTags.userId, userId)));
    return row;
  }

  /** Visible scores with a tag, sorted by title (M-8, F-6). */
  async taggedScores(
    ensembleIds: readonly string[],
    filter: ScoreFilter,
    cursor: CursorKey | undefined,
    limit: number,
  ): Promise<ScoreListRow[]> {
    if (!ensembleIds.length) return [];
    const rows = await this.db
      .select({ scoreId: scores.id, title: scores.title, composer: scores.composer, sortKey: sql<string>`lower(${scores.title})` })
      .from(scores)
      .where(
        and(
          sql`${scores.id} in ${visibleScoreIds(ensembleIds)}`,
          ...this.scoreFilter(filter),
          afterNameAndId(scores.title, scores.id, cursor),
        ),
      )
      .orderBy(sql`lower(${scores.title})`, asc(scores.id))
      .limit(limit + 1);
    return rows.map((r) => ({ ...r, number: null }));
  }

  // --- score (M-3, M-8, M-9) ----------------------------------------------------------------------------------

  async visibleScore(ensembleIds: readonly string[], scoreId: string) {
    if (!ensembleIds.length) return undefined;
    const [row] = await this.db
      .select({ id: scores.id, title: scores.title, composer: scores.composer, arranger: scores.arranger })
      .from(scores)
      .where(and(eq(scores.id, scoreId), sql`${scores.id} in ${visibleScoreIds(ensembleIds)}`));
    return row;
  }

  async scoreTags(userId: string, scoreId: string) {
    const [club, personal] = await Promise.all([
      this.db
        .select({ id: clubTags.id, name: clubTags.name })
        .from(scoreClubTags)
        .innerJoin(clubTags, eq(clubTags.id, scoreClubTags.tagId))
        .where(eq(scoreClubTags.scoreId, scoreId))
        .orderBy(sql`lower(${clubTags.name})`),
      this.db
        .select({ id: personalTags.id, name: personalTags.name })
        .from(scorePersonalTags)
        .innerJoin(personalTags, eq(personalTags.id, scorePersonalTags.personalTagId))
        .where(and(eq(scorePersonalTags.scoreId, scoreId), eq(personalTags.userId, userId)))
        .orderBy(sql`lower(${personalTags.name})`),
    ]);
    return { club, personal };
  }

  // --- personal tags (M-8) ------------------------------------------------------------------------------------

  async personalTagNameTaken(userId: string, name: string, exceptId?: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: personalTags.id })
      .from(personalTags)
      .where(
        and(
          eq(personalTags.userId, userId),
          sql`lower(${personalTags.name}) = lower(${name})`,
          exceptId ? ne(personalTags.id, exceptId) : undefined,
        ),
      );
    return !!row;
  }

  async insertPersonalTag(id: string, userId: string, name: string): Promise<void> {
    await this.db.insert(personalTags).values({ id, userId, name });
  }

  async renamePersonalTag(id: string, name: string): Promise<void> {
    await this.db.update(personalTags).set({ name }).where(eq(personalTags.id, id));
  }

  async deletePersonalTag(id: string): Promise<void> {
    await this.db.delete(personalTags).where(eq(personalTags.id, id));
  }

  async tagScore(tagId: string, scoreId: string): Promise<void> {
    // No true "do nothing" upsert in MySQL; a self-assign is a no-op when the row already exists.
    await this.db
      .insert(scorePersonalTags)
      .values({ personalTagId: tagId, scoreId })
      .onDuplicateKeyUpdate({ set: { personalTagId: sql`${scorePersonalTags.personalTagId}` } });
  }

  async untagScore(tagId: string, scoreId: string): Promise<void> {
    await this.db
      .delete(scorePersonalTags)
      .where(and(eq(scorePersonalTags.personalTagId, tagId), eq(scorePersonalTags.scoreId, scoreId)));
  }

  private scoreFilter(filter: ScoreFilter): (SQL | undefined)[] {
    return [
      filter.q ? or(like(scores.title, likePattern(filter.q)), like(scores.composer, likePattern(filter.q))) : undefined,
      filter.clubTagId ? hasClubTag(filter.clubTagId) : undefined,
      filter.personalTag
        ? sql`exists (select 1 from score_personal_tags x join personal_tags p on p.id = x.personal_tag_id
                       where x.score_id = ${scores.id} and p.id = ${filter.personalTag.tagId}
                         and p.user_id = ${filter.personalTag.userId})`
        : undefined,
    ];
  }
}
