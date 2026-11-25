import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type {
  CreateFolderBody,
  EnsembleOptionsResponse,
  FolderDetailsResponse,
  FolderEntriesQuery,
  FolderEntry,
  FolderListItem,
  FolderListQuery,
  FolderScoreCandidatesResponse,
  Page,
} from '@vm-web/shared';
import type { AccessContext } from '../access/access-context';
import { EnsembleResolvers } from '../access/ensemble-resolvers';
import { uuidv7 } from '../common/ids/uuid-v7';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { withNameTaken } from '../db/db-errors';
import { listEnsembles } from '../library/library-helpers';
import { folderNumberSortKey } from './folder-number';
import { FoldersRepository, type FolderEntryNumber } from './folders.repository';

@Injectable()
export class FoldersService implements OnModuleInit {
  constructor(
    @Inject(FoldersRepository) private readonly repo: FoldersRepository,
    @Inject(EnsembleResolvers) private readonly resolvers: EnsembleResolvers,
  ) {}

  onModuleInit(): void {
    this.resolvers.register('folder', (id) => this.repo.ensembleOf(id));
  }

  async ensembleOptions(access: AccessContext): Promise<EnsembleOptionsResponse> {
    const ids = access.ensemblesWith('folder.create');
    if (!ids.length) throw ProblemException.forbidden();
    return { items: await this.repo.activeEnsembleOptions(ids) };
  }

  async list(access: AccessContext, query: FolderListQuery): Promise<Page<FolderListItem>> {
    const ids = listEnsembles(access, 'folder.view', query.ensembleId);
    if (!ids.length) return { items: [], nextCursor: null };
    const rows = await this.repo.list(ids, query.q, decodeCursor(query.cursor, 3), query.limit);
    return toPage(rows, query.limit, (r) => [r.sortEnsemble, r.sortName, r.id], (r) => ({
      id: r.id,
      name: r.name,
      ensemble: r.ensemble,
      showInMyArea: r.showInMyArea,
      scoreCount: r.scoreCount,
    }));
  }

  async details(folderId: string): Promise<FolderDetailsResponse> {
    const row = await this.repo.details(folderId);
    if (!row) throw ProblemException.notFound();
    return { ...row, updatedAt: row.updatedAt.toISOString() };
  }

  async entries(folderId: string, query: FolderEntriesQuery): Promise<Page<FolderEntry>> {
    const rows = await this.repo.entries(folderId, query.q, decodeCursor(query.cursor, 2), query.limit);
    return toPage(rows, query.limit, (r) => [r.sortKey, r.scoreId], (r) => ({
      scoreId: r.scoreId,
      number: r.number,
      numberSuffix: r.numberSuffix,
      title: r.title,
      composer: r.composer,
    }));
  }

  async candidates(folderId: string, query: { q: string; cursor?: string; limit: number }): Promise<FolderScoreCandidatesResponse> {
    const [page, suggestedNumber] = await Promise.all([this.repo.scoreCandidates(folderId, query), this.suggestedNumber(folderId)]);
    return { ...page, suggestedNumber };
  }

  async create(body: CreateFolderBody): Promise<{ id: string }> {
    const id = uuidv7();
    const result = await withNameTaken(() => this.repo.create({ id, ensembleId: body.ensembleId, name: body.name, showInMyArea: body.showInMyArea }));
    if (result === 'unknown-ensemble') throw ProblemException.notFound('Unknown ensemble');
    if (result === 'archived-ensemble') throw ProblemException.validation([{ path: '/body/ensembleId', code: 'archived' }]);
    return { id };
  }

  async rename(folderId: string, name: string): Promise<void> {
    if (!(await withNameTaken(() => this.repo.update(folderId, { name })))) throw ProblemException.notFound();
  }

  async setVisibility(folderId: string, showInMyArea: boolean): Promise<void> {
    if (!(await this.repo.update(folderId, { showInMyArea }))) throw ProblemException.notFound();
  }

  async addScore(folderId: string, scoreId: string, number: string, numberSuffix: string | null = null): Promise<void> {
    const result = await withNameTaken(() => this.repo.addEntry(folderId, scoreId, entryNumber(number, numberSuffix)));
    if (result === 'unknown-folder') throw ProblemException.notFound();
    if (result === 'unknown-score') throw ProblemException.notFound('Unknown score');
    if (result === 'already-contained') throw ProblemException.conflict('conflict', 'Score already in folder');
  }

  async setScoreNumber(folderId: string, scoreId: string, number: string, numberSuffix: string | null = null): Promise<void> {
    if (!(await withNameTaken(() => this.repo.setEntryNumber(folderId, scoreId, entryNumber(number, numberSuffix))))) throw ProblemException.notFound();
  }

  async removeScore(folderId: string, scoreId: string): Promise<void> {
    if (!(await this.repo.removeEntry(folderId, scoreId))) throw ProblemException.notFound();
  }

  async delete(folderId: string): Promise<void> {
    await this.repo.delete(folderId);
  }

  private async suggestedNumber(folderId: string): Promise<string> {
    const max = await this.repo.highestNumericNumber(folderId);
    if (!max) return '1';
    return String(BigInt(max) + BigInt(1));
  }
}

function entryNumber(number: string, numberSuffix: string | null): FolderEntryNumber {
  return { number, numberSuffix, numberSortKey: folderNumberSortKey(number, numberSuffix) };
}
