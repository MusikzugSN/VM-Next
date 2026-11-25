import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database';
import { events, folderEntries, folders, scores, setlistEntries, sheets, voices } from '../db/schema';
import { displayFolderNumber } from '../folders/folder-number';
import { MeRepository } from '../me/me.repository';

export interface NumberedScoreRow {
  scoreId: string;
  title: string;
  number: string | null;
}

@Injectable()
export class DownloadsRepository {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(MeRepository) private readonly me: MeRepository,
  ) {}

  async sheetWithNames(sheetId: string) {
    const [row] = await this.db
      .select({ scoreId: sheets.scoreId, fileKey: sheets.fileKey, title: scores.title, voice: voices.name })
      .from(sheets)
      .innerJoin(scores, eq(scores.id, sheets.scoreId))
      .innerJoin(voices, eq(voices.id, sheets.voiceId))
      .where(eq(sheets.id, sheetId));
    return row;
  }

  async scoreTitles(scoreIds: readonly string[], visibleInEnsembles: readonly string[] | 'all'): Promise<{ id: string; title: string }[]> {
    if (!scoreIds.length || (visibleInEnsembles !== 'all' && !visibleInEnsembles.length)) return [];
    return this.db
      .select({ id: scores.id, title: scores.title })
      .from(scores)
      .where(
        and(
          inArray(scores.id, [...scoreIds]),
          visibleInEnsembles === 'all' ? undefined : sql`${scores.id} in ${this.me.visibleScoreIdsSql(visibleInEnsembles)}`,
        ),
      );
  }

  async folder(folderId: string): Promise<{ name: string; ensembleId: string } | undefined> {
    const [row] = await this.db.select({ name: folders.name, ensembleId: folders.ensembleId }).from(folders).where(eq(folders.id, folderId));
    return row;
  }

  async event(eventId: string): Promise<{ name: string; date: string; ensembleId: string } | undefined> {
    const [row] = await this.db
      .select({ name: events.name, date: events.date, ensembleId: events.ensembleId })
      .from(events)
      .where(eq(events.id, eventId));
    return row;
  }

  async folderEntries(folderId: string): Promise<NumberedScoreRow[]> {
    return this.db
      .select({ scoreId: scores.id, title: scores.title, number: displayFolderNumber })
      .from(folderEntries)
      .innerJoin(scores, eq(scores.id, folderEntries.scoreId))
      .where(eq(folderEntries.folderId, folderId))
      .orderBy(asc(folderEntries.numberSortKey), asc(scores.id));
  }

  async setlistEntries(eventId: string): Promise<{ scoreId: string; title: string; position: number }[]> {
    return this.db
      .select({ scoreId: scores.id, title: scores.title, position: setlistEntries.position })
      .from(setlistEntries)
      .innerJoin(scores, eq(scores.id, setlistEntries.scoreId))
      .where(eq(setlistEntries.eventId, eventId))
      .orderBy(asc(setlistEntries.position));
  }

  async fileKeys(sheetIds: readonly string[]): Promise<Map<string, string>> {
    if (!sheetIds.length) return new Map();
    const rows = await this.db.select({ id: sheets.id, fileKey: sheets.fileKey }).from(sheets).where(inArray(sheets.id, [...sheetIds]));
    return new Map(rows.map((r) => [r.id, r.fileKey]));
  }
}
