import { Inject, Injectable } from '@nestjs/common';
import type { EnsembleOption } from '@vm-web/shared';
import { and, asc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { activeEnsembleOptions } from '../common/ensemble-tree';
import { likePattern } from '../common/sql';
import { DATABASE, type Database, type Tx } from '../db/database';
import { ensembles, folderEntries, folders, scores } from '../db/schema';
import { scoreCandidatePage } from '../library/library-helpers';
import { displayFolderNumber } from './folder-number';

const scoreCount = sql<number>`(select count(*) from folder_entries x where x.folder_id = ${folders.id})`;

type Cursor = readonly (string | number | null)[] | undefined;

export interface FolderEntryNumber {
  number: string;
  numberSuffix: string | null;
  numberSortKey: string;
}

export type CreateFolderResult = 'created' | 'unknown-ensemble' | 'archived-ensemble';
export type AddEntryResult = 'added' | 'unknown-folder' | 'unknown-score' | 'already-contained';

@Injectable()
export class FoldersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async ensembleOf(folderId: string): Promise<string | null> {
    const [row] = await this.db.select({ ensembleId: folders.ensembleId }).from(folders).where(eq(folders.id, folderId));
    return row?.ensembleId ?? null;
  }

  activeEnsembleOptions(ensembleIds: readonly string[]): Promise<EnsembleOption[]> {
    return activeEnsembleOptions(this.db, ensembleIds);
  }

  list(ensembleIds: string[], q: string | undefined, cursor: Cursor, limit: number) {
    return this.db
      .select({
        id: folders.id,
        name: folders.name,
        ensemble: { id: ensembles.id, name: ensembles.name },
        showInMyArea: folders.showInMyArea,
        scoreCount,
        sortEnsemble: sql<string>`lower(${ensembles.name})`,
        sortName: sql<string>`lower(${folders.name})`,
      })
      .from(folders)
      .innerJoin(ensembles, eq(ensembles.id, folders.ensembleId))
      .where(
        and(
          inArray(folders.ensembleId, ensembleIds),
          q ? like(folders.name, likePattern(q)) : undefined,
          cursor ? sql`(lower(${ensembles.name}), lower(${folders.name}), ${folders.id}) > (${cursor[0]}, ${cursor[1]}, ${cursor[2]})` : undefined,
        ),
      )
      .orderBy(sql`lower(${ensembles.name})`, sql`lower(${folders.name})`, asc(folders.id))
      .limit(limit + 1);
  }

  async details(folderId: string) {
    const [row] = await this.db
      .select({
        id: folders.id,
        name: folders.name,
        ensemble: { id: ensembles.id, name: ensembles.name },
        showInMyArea: folders.showInMyArea,
        scoreCount,
        updatedAt: folders.updatedAt,
      })
      .from(folders)
      .innerJoin(ensembles, eq(ensembles.id, folders.ensembleId))
      .where(eq(folders.id, folderId));
    return row;
  }

  entries(folderId: string, q: string | undefined, cursor: Cursor, limit: number) {
    return this.db
      .select({
        scoreId: scores.id,
        number: folderEntries.number,
        numberSuffix: folderEntries.numberSuffix,
        title: scores.title,
        composer: scores.composer,
        sortKey: folderEntries.numberSortKey,
      })
      .from(folderEntries)
      .innerJoin(scores, eq(scores.id, folderEntries.scoreId))
      .where(
        and(
          eq(folderEntries.folderId, folderId),
          q ? or(like(scores.title, likePattern(q)), like(scores.composer, likePattern(q)), like(displayFolderNumber, likePattern(q))) : undefined,
          cursor ? sql`(${folderEntries.numberSortKey}, ${scores.id}) > (${cursor[0]}, ${cursor[1]})` : undefined,
        ),
      )
      .orderBy(asc(folderEntries.numberSortKey), asc(scores.id))
      .limit(limit + 1);
  }

  scoreCandidates(folderId: string, query: { q: string; cursor?: string; limit: number }) {
    const contained = sql<boolean>`exists (select 1 from folder_entries x where x.folder_id = ${folderId} and x.score_id = ${scores.id})`;
    return scoreCandidatePage(this.db, query, contained);
  }

  async highestNumericNumber(folderId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ max: sql<string | null>`max(cast(${folderEntries.number} as unsigned))` })
      .from(folderEntries)
      .where(and(eq(folderEntries.folderId, folderId), sql`${folderEntries.number} regexp '^[0-9]{1,15}$'`));
    return row?.max ?? null;
  }

  create(folder: { id: string; ensembleId: string; name: string; showInMyArea: boolean }): Promise<CreateFolderResult> {
    return this.db.transaction(async (tx) => {
      const [ensemble] = await tx.select({ archivedAt: ensembles.archivedAt }).from(ensembles).where(eq(ensembles.id, folder.ensembleId)).for('share');
      if (!ensemble) return 'unknown-ensemble';
      if (ensemble.archivedAt) return 'archived-ensemble';
      await tx.insert(folders).values(folder);
      return 'created';
    });
  }

  async update(folderId: string, set: { name?: string; showInMyArea?: boolean }): Promise<boolean> {
    return this.touch(this.db, folderId, set);
  }

  addEntry(folderId: string, scoreId: string, entry: FolderEntryNumber): Promise<AddEntryResult> {
    return this.db.transaction(async (tx) => {
      const [folder] = await tx.select({ id: folders.id }).from(folders).where(eq(folders.id, folderId)).for('update');
      if (!folder) return 'unknown-folder';
      const [score] = await tx.select({ id: scores.id }).from(scores).where(eq(scores.id, scoreId)).for('share');
      if (!score) return 'unknown-score';
      const [existing] = await tx
        .select({ scoreId: folderEntries.scoreId })
        .from(folderEntries)
        .where(and(eq(folderEntries.folderId, folderId), eq(folderEntries.scoreId, scoreId)));
      if (existing) return 'already-contained';
      await tx.insert(folderEntries).values({ folderId, scoreId, ...entry });
      await this.touch(tx, folderId, {});
      return 'added';
    });
  }

  setEntryNumber(folderId: string, scoreId: string, entry: FolderEntryNumber): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [result] = await tx
        .update(folderEntries)
        .set(entry)
        .where(and(eq(folderEntries.folderId, folderId), eq(folderEntries.scoreId, scoreId)));
      if (!result.affectedRows) return false;
      return this.touch(tx, folderId, {});
    });
  }

  removeEntry(folderId: string, scoreId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [result] = await tx.delete(folderEntries).where(and(eq(folderEntries.folderId, folderId), eq(folderEntries.scoreId, scoreId)));
      if (!result.affectedRows) return false;
      return this.touch(tx, folderId, {});
    });
  }

  async delete(folderId: string): Promise<void> {
    await this.db.delete(folders).where(eq(folders.id, folderId));
  }

  private async touch(db: Database | Tx, folderId: string, set: { name?: string; showInMyArea?: boolean }): Promise<boolean> {
    const [result] = await db.update(folders).set({ ...set, updatedAt: new Date() }).where(eq(folders.id, folderId));
    return result.affectedRows > 0;
  }
}
