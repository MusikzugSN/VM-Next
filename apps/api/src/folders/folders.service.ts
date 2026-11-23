import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type {
  CreateFolderBody,
  FolderDetailsResponse,
  FolderEntriesQuery,
  FolderEntry,
  FolderListItem,
  FolderListQuery,
  FolderScoreCandidatesResponse,
  Page,
} from '@vm-web/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { AccessContext } from '../access/access-context';
import { EnsembleResolvers } from '../access/ensemble-resolvers';
import { uuidv7 } from '../common/ids/uuid-v7';
import { naturalSortKey } from '../common/natural-sort';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { DATABASE, type Database } from '../db/database';
import { withNameTaken } from '../db/db-errors';
import { ensembles, folderEntries, folders, scores } from '../db/schema';
import { assertActiveEnsemble, ensembleOptions, listEnsembles, scoreCandidates } from '../library/library-helpers';
import { likePattern } from '../common/sql';

const scoreCount = sql<number>`(select count(*)::int from folder_entries x where x.folder_id = ${folders.id})`;

/** Folders of ensembles with own number per score (N-5, N-15). Permissions: `folder.*` in the folder's ensemble. */
@Injectable()
export class FoldersService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(EnsembleResolvers) private readonly resolvers: EnsembleResolvers,
  ) {}

  onModuleInit(): void {
    this.resolvers.register('folder', async (id) => {
      const [row] = await this.db.select({ ensembleId: folders.ensembleId }).from(folders).where(eq(folders.id, id));
      return row?.ensembleId ?? null;
    });
  }

  ensembleOptions(access: AccessContext) {
    return ensembleOptions(this.db, access, 'folder.create').then((items) => ({ items }));
  }

  async list(access: AccessContext, query: FolderListQuery): Promise<Page<FolderListItem>> {
    const ids = listEnsembles(access, 'folder.view', query.ensembleId);
    if (!ids.length) return { items: [], nextCursor: null };
    const cursor = decodeCursor(query.cursor, 3);
    const rows = await this.db
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
          inArray(folders.ensembleId, ids),
          query.q ? sql`${folders.name} ilike ${likePattern(query.q)}` : undefined,
          cursor ? sql`(lower(${ensembles.name}), lower(${folders.name}), ${folders.id}) > (${cursor[0]}, ${cursor[1]}, ${cursor[2]}::uuid)` : undefined,
        ),
      )
      .orderBy(sql`lower(${ensembles.name})`, sql`lower(${folders.name})`, asc(folders.id))
      .limit(query.limit + 1);
    return toPage(rows, query.limit, (r) => [r.sortEnsemble, r.sortName, r.id], (r) => ({
      id: r.id,
      name: r.name,
      ensemble: r.ensemble,
      showInMyArea: r.showInMyArea,
      scoreCount: r.scoreCount,
    }));
  }

  async details(folderId: string): Promise<FolderDetailsResponse> {
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
    if (!row) throw ProblemException.notFound();
    return { ...row, updatedAt: row.updatedAt.toISOString() };
  }

  /** Natural number order (N-5). */
  async entries(folderId: string, query: FolderEntriesQuery): Promise<Page<FolderEntry>> {
    const cursor = decodeCursor(query.cursor, 2);
    const rows = await this.db
      .select({
        scoreId: scores.id,
        number: folderEntries.number,
        title: scores.title,
        composer: scores.composer,
        sortKey: folderEntries.numberSortKey,
      })
      .from(folderEntries)
      .innerJoin(scores, eq(scores.id, folderEntries.scoreId))
      .where(
        and(
          eq(folderEntries.folderId, folderId),
          query.q ? sql`(${scores.title} ilike ${likePattern(query.q)} or ${scores.composer} ilike ${likePattern(query.q)} or ${folderEntries.number} ilike ${likePattern(query.q)})` : undefined,
          cursor ? sql`(${folderEntries.numberSortKey}, ${scores.id}) > (${cursor[0]}, ${cursor[1]}::uuid)` : undefined,
        ),
      )
      .orderBy(asc(folderEntries.numberSortKey), asc(scores.id))
      .limit(query.limit + 1);
    return toPage(rows, query.limit, (r) => [r.sortKey, r.scoreId], (r) => ({
      scoreId: r.scoreId,
      number: r.number,
      title: r.title,
      composer: r.composer,
    }));
  }

  async candidates(folderId: string, query: { q: string; cursor?: string; limit: number }): Promise<FolderScoreCandidatesResponse> {
    const contained = sql<boolean>`exists (select 1 from folder_entries x where x.folder_id = ${folderId}::uuid and x.score_id = ${scores.id})`;
    const rows = await scoreCandidates(this.db, query.q, contained, decodeCursor(query.cursor, 2), query.limit);
    const page = toPage(rows, query.limit, (r) => [r.sortKey, r.id], (r) => ({
      id: r.id,
      title: r.title,
      composer: r.composer,
      alreadyContained: r.alreadyContained,
    }));
    return { ...page, suggestedNumber: await this.suggestedNumber(folderId) };
  }

  async create(body: CreateFolderBody): Promise<{ id: string }> {
    await assertActiveEnsemble(this.db, body.ensembleId);
    const id = uuidv7();
    await withNameTaken(() => this.db.insert(folders).values({ id, ensembleId: body.ensembleId, name: body.name, showInMyArea: body.showInMyArea }));
    return { id };
  }

  async rename(folderId: string, name: string): Promise<void> {
    await withNameTaken(() => this.touch(folderId, { name }));
  }

  async setVisibility(folderId: string, showInMyArea: boolean): Promise<void> {
    await this.touch(folderId, { showInMyArea });
  }

  async addScore(folderId: string, scoreId: string, number: string): Promise<void> {
    await this.assertScore(scoreId);
    const [existing] = await this.db
      .select({ number: folderEntries.number })
      .from(folderEntries)
      .where(and(eq(folderEntries.folderId, folderId), eq(folderEntries.scoreId, scoreId)));
    if (existing) throw ProblemException.conflict('conflict', 'Score already in folder');
    await withNameTaken(() => this.db.insert(folderEntries).values({ folderId, scoreId, number, numberSortKey: naturalSortKey(number) }));
    await this.touch(folderId, {});
  }

  async setScoreNumber(folderId: string, scoreId: string, number: string): Promise<void> {
    const updated = await withNameTaken(() =>
      this.db
        .update(folderEntries)
        .set({ number, numberSortKey: naturalSortKey(number) })
        .where(and(eq(folderEntries.folderId, folderId), eq(folderEntries.scoreId, scoreId)))
        .returning({ scoreId: folderEntries.scoreId }),
    );
    if (!updated.length) throw ProblemException.notFound();
    await this.touch(folderId, {});
  }

  async removeScore(folderId: string, scoreId: string): Promise<void> {
    const removed = await this.db
      .delete(folderEntries)
      .where(and(eq(folderEntries.folderId, folderId), eq(folderEntries.scoreId, scoreId)))
      .returning({ scoreId: folderEntries.scoreId });
    if (!removed.length) throw ProblemException.notFound();
    await this.touch(folderId, {});
  }

  async delete(folderId: string): Promise<void> {
    await this.db.delete(folders).where(eq(folders.id, folderId));
  }

  /** Highest purely numeric number + 1, `1` for an empty folder. */
  private async suggestedNumber(folderId: string): Promise<string> {
    const [row] = await this.db.execute<{ max: string | null }>(sql`
      select max(number::bigint)::text as max from folder_entries
       where folder_id = ${folderId}::uuid and number ~ '^[0-9]{1,15}$'`).then((r) => r.rows);
    if (!row?.max) return '1';
    return String(BigInt(row.max) + BigInt(1));
  }

  private async assertScore(scoreId: string): Promise<void> {
    const [row] = await this.db.select({ id: scores.id }).from(scores).where(eq(scores.id, scoreId));
    if (!row) throw ProblemException.notFound('Unknown score');
  }

  private async touch(folderId: string, set: Partial<typeof folders.$inferInsert>): Promise<void> {
    const [row] = await this.db.update(folders).set({ ...set, updatedAt: new Date() }).where(eq(folders.id, folderId)).returning({ id: folders.id });
    if (!row) throw ProblemException.notFound();
  }
}
