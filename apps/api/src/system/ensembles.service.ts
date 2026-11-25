import { Inject, Injectable } from '@nestjs/common';
import type {
  ApplyLineupTemplateResponse,
  CreateEnsembleBody,
  EnsembleDetailsResponse,
  EnsembleLineupResponse,
  EnsembleListItem,
  EnsembleListQuery,
  EnsembleMember,
  EnsembleOptionsResponse,
  Page,
} from '@vm-web/shared';
import type { AccessContext } from '../access/access-context';
import { appendTo } from '../common/collections';
import { uuidv7 } from '../common/ids/uuid-v7';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { httpUrlOrNull } from '../common/url';
import { assertKnownIds, assertNoDuplicates } from '../common/validation/id-list';
import { withNameTaken } from '../db/db-errors';
import { assertEnsembleInScope } from '../library/library-helpers';
import { lineupTemplateFile } from '../seed/defaults';
import { loadLineupTemplate } from '../seed/lineup-template';
import { EnsemblesRepository, type EnsembleRecord, type EnsembleTreeRow } from './ensembles.repository';

@Injectable()
export class EnsemblesService {
  constructor(@Inject(EnsemblesRepository) private readonly repo: EnsemblesRepository) {}

  async list(query: EnsembleListQuery): Promise<Page<EnsembleListItem>> {
    const tree = await this.tree(query.includeArchived);
    const start = query.cursor ? Number(decodeCursor(query.cursor, 1)?.[0]) : 0;
    const items = tree.slice(start, start + query.limit);
    const end = start + items.length;
    return { items, nextCursor: end < tree.length ? encodeCursor([end]) : null };
  }

  async details(ensembleId: string): Promise<EnsembleDetailsResponse> {
    const item = (await this.tree(true)).find((e) => e.id === ensembleId);
    if (!item) throw ProblemException.notFound();
    const record = await this.ensemble(ensembleId);
    return { ...item, createdAt: record.createdAt.toISOString(), archivedAt: record.archivedAt?.toISOString() ?? null };
  }

  async lineup(ensembleId: string): Promise<EnsembleLineupResponse> {
    await this.ensemble(ensembleId);
    return { voices: await this.repo.lineup(ensembleId) };
  }

  async members(ensembleId: string, query: { q?: string; cursor?: string; limit: number }): Promise<Page<EnsembleMember>> {
    await this.ensemble(ensembleId);
    const rows = await this.repo.members(ensembleId, query.q, decodeCursor(query.cursor, 2), query.limit);
    const page = rows.slice(0, query.limit);
    const voiceRows = await this.repo.profileVoices(page.map((r) => r.userId));
    const last = page.at(-1);
    return {
      items: page.map((r) => ({
        userId: r.userId,
        name: r.name,
        pictureUrl: httpUrlOrNull(r.pictureUrl),
        role: r.role,
        voices: voiceRows.filter((v) => v.userId === r.userId).map(({ id, name, instrumentId }) => ({ id, name, instrumentId })),
      })),
      nextCursor: rows.length > query.limit && last ? encodeCursor([last.sortKey, last.userId]) : null,
    };
  }

  async create(body: CreateEnsembleBody): Promise<{ id: string }> {
    await this.ensemble(body.parentId, 'Unknown parent');
    const template = body.applyLineupTemplate ? await loadLineupTemplate(lineupTemplateFile()) : undefined;
    const id = uuidv7();
    await withNameTaken(() =>
      this.repo.create({ id, parentId: body.parentId, name: body.name }, template, (parent) => {
        if (!parent) throw ProblemException.notFound('Unknown parent');
        if (parent.archivedAt) throw ProblemException.validation([{ path: '/body/parentId', code: 'archived' }]);
      }),
    );
    return { id };
  }

  async rename(ensembleId: string, name: string): Promise<void> {
    await this.ensemble(ensembleId);
    await withNameTaken(() => this.repo.rename(ensembleId, name));
  }

  async options(): Promise<EnsembleOptionsResponse> {
    return { items: await this.repo.activeOptions() };
  }

  async setParent(access: AccessContext, ensembleId: string, parentId: string): Promise<void> {
    assertEnsembleInScope(access, 'ensemble.edit', ensembleId);
    await withNameTaken(() =>
      this.repo.move(ensembleId, parentId, (tree) => {
        const ensemble = tree.find((e) => e.id === ensembleId);
        if (!ensemble) throw ProblemException.notFound();
        if (ensemble.isRoot) throw ProblemException.conflict('root-ensemble');
        if (!tree.some((e) => e.id === parentId)) throw ProblemException.notFound('Unknown parent');
        if (parentId === ensembleId || descendantsOf(ensembleId, tree).has(parentId)) throw ProblemException.conflict('invalid-hierarchy');
      }),
    );
  }

  async archive(ensembleId: string): Promise<void> {
    await this.repo.archive(ensembleId, ({ ensemble, isDefault, hasActiveChildren }) => {
      if (!ensemble) throw ProblemException.notFound();
      if (ensemble.isRoot) throw ProblemException.conflict('root-ensemble');
      if (isDefault) throw ProblemException.conflict('in-use', 'Default ensemble');
      if (hasActiveChildren) throw ProblemException.conflict('in-use', 'Ensemble has active sub-ensembles');
    });
  }

  async unarchive(ensembleId: string): Promise<void> {
    await this.repo.unarchive(ensembleId, ({ ensemble, parent }) => {
      if (!ensemble) throw ProblemException.notFound();
      if (ensemble.parentId && !parent) throw ProblemException.notFound();
      if (parent?.archivedAt) throw ProblemException.conflict('conflict', 'Parent ensemble is archived');
    });
  }

  async setLineup(ensembleId: string, voiceIds: readonly string[]): Promise<void> {
    await this.ensemble(ensembleId);
    assertNoDuplicates(voiceIds, '/body/voiceIds');
    assertKnownIds(voiceIds, await this.repo.existingVoiceIds(voiceIds), '/body/voiceIds', 'unknown_voice');
    await this.repo.setLineup(ensembleId, voiceIds);
  }

  async applyLineupTemplate(ensembleId: string): Promise<ApplyLineupTemplateResponse> {
    await this.ensemble(ensembleId);
    return this.repo.applyLineupTemplate(ensembleId, await loadLineupTemplate(lineupTemplateFile()));
  }

  private async tree(includeArchived: boolean): Promise<EnsembleListItem[]> {
    const [rows, defaultEnsembleId] = await Promise.all([this.repo.treeRows(), this.repo.defaultEnsembleId()]);
    const byParent = new Map<string | null, EnsembleTreeRow[]>();
    for (const r of rows) appendTo(byParent, r.parentId, r);
    const result: EnsembleListItem[] = [];
    const walk = (parentId: string | null, depth: number) => {
      const children = (byParent.get(parentId) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'de'));
      for (const e of children) {
        if (e.archivedAt && !includeArchived) continue;
        result.push({
          id: e.id,
          name: e.name,
          parentId: e.parentId,
          depth,
          isRoot: e.isRoot,
          archived: !!e.archivedAt,
          isDefault: defaultEnsembleId === e.id,
          memberCount: e.memberCount,
          lineupSize: e.lineupSize,
        });
        walk(e.id, depth + 1);
      }
    };
    walk(null, 0);
    return result;
  }

  private async ensemble(id: string, detail?: string): Promise<EnsembleRecord> {
    const row = await this.repo.find(id);
    if (!row) throw ProblemException.notFound(detail);
    return row;
  }
}

export function descendantsOf(id: string, all: readonly { id: string; parentId: string | null }[]): Set<string> {
  const result = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop() as string;
    for (const e of all) {
      if (e.parentId === current && !result.has(e.id)) {
        result.add(e.id);
        stack.push(e.id);
      }
    }
  }
  return result;
}
