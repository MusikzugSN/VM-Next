import { Inject, Injectable } from '@nestjs/common';
import type { ClubTagItem, ClubTagListQuery, Page } from '@vm-web/shared';
import { uuidv7 } from '../common/ids/uuid-v7';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { TagsRepository } from './tags.repository';

@Injectable()
export class TagsService {
  constructor(@Inject(TagsRepository) private readonly repo: TagsRepository) {}

  async list(query: ClubTagListQuery): Promise<Page<ClubTagItem>> {
    const rows = await this.repo.listPage(query, decodeCursor(query.cursor, 2));
    return toPage(rows, query.limit, (r) => [r.sortKey, r.id], (r) => ({ id: r.id, name: r.name, scoreCount: r.scoreCount }));
  }

  async create(name: string): Promise<{ id: string }> {
    const id = uuidv7();
    await this.repo.insert(id, name);
    return { id };
  }

  async rename(tagId: string, name: string): Promise<void> {
    if (!(await this.repo.rename(tagId, name))) throw ProblemException.notFound();
  }

  async delete(tagId: string): Promise<void> {
    if (!(await this.repo.delete(tagId))) throw ProblemException.notFound();
  }
}
