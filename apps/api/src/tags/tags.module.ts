import { Body, Controller, Get, HttpCode, Inject, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import {
  API_ROUTES,
  clubTagListQuerySchema,
  clubTagListResponseSchema,
  createClubTagBodySchema,
  createdResponseSchema,
  renameBodySchema,
  tagParamsSchema,
  type ClubTagItem,
  type ClubTagListQuery,
  type CreateClubTagBody,
  type Page,
  type RenameBody,
} from '@vm-web/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { RequirePermission } from '../access/decorators';
import { uuidv7 } from '../common/ids/uuid-v7';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe as Zod } from '../common/validation/zod-validation.pipe';
import { DATABASE, type Database } from '../db/database';
import { isUniqueViolation } from '../db/db-errors';
import { clubTags } from '../db/schema';
import { likePattern } from '../me/me.repository';

/** Club tags, maintained by librarians (N-17); separate from personal tags (M-8). */
@Injectable()
export class TagsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(query: ClubTagListQuery): Promise<Page<ClubTagItem>> {
    const cursor = decodeCursor(query.cursor, 2);
    const rows = await this.db
      .select({
        id: clubTags.id,
        name: clubTags.name,
        scoreCount: sql<number>`(select count(*)::int from score_club_tags x where x.tag_id = ${clubTags.id})`,
        sortKey: sql<string>`lower(${clubTags.name})`,
      })
      .from(clubTags)
      .where(
        and(
          query.q ? sql`${clubTags.name} ilike ${likePattern(query.q)}` : undefined,
          cursor ? sql`(lower(${clubTags.name}), ${clubTags.id}) > (${cursor[0]}, ${cursor[1]}::uuid)` : undefined,
        ),
      )
      .orderBy(sql`lower(${clubTags.name})`, asc(clubTags.id))
      .limit(query.limit + 1);
    return toPage(rows, query.limit, (r) => [r.sortKey, r.id], (r) => ({ id: r.id, name: r.name, scoreCount: r.scoreCount }));
  }

  async create(name: string): Promise<{ id: string }> {
    const id = uuidv7();
    await this.unique(() => this.db.insert(clubTags).values({ id, name }));
    return { id };
  }

  async rename(tagId: string, name: string): Promise<void> {
    const rows = await this.unique(() => this.db.update(clubTags).set({ name }).where(eq(clubTags.id, tagId)).returning({ id: clubTags.id }));
    if (!rows.length) throw ProblemException.notFound();
  }

  async delete(tagId: string): Promise<void> {
    const rows = await this.db.delete(clubTags).where(eq(clubTags.id, tagId)).returning({ id: clubTags.id });
    if (!rows.length) throw ProblemException.notFound();
  }

  private async unique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error)) throw ProblemException.conflict('name-taken');
      throw error;
    }
  }
}

const R = API_ROUTES.tags;

/** Club tags have no ensemble → `tag.*` in at least one ensemble (R-4). */
@Controller(R.base)
export class TagsController {
  constructor(@Inject(TagsService) private readonly tags: TagsService) {}

  @RequirePermission('tag.view')
  @Get(R.clubTagList.path)
  @ResponseSchema(clubTagListResponseSchema)
  list(@Query(new Zod(clubTagListQuerySchema)) q: ClubTagListQuery) {
    return this.tags.list(q);
  }

  @RequirePermission('tag.create')
  @Post(R.createTag.path)
  @ResponseSchema(createdResponseSchema)
  create(@Body(new Zod(createClubTagBodySchema)) body: CreateClubTagBody) {
    return this.tags.create(body.name);
  }

  @RequirePermission('tag.edit')
  @Post(R.renameTag.path)
  @HttpCode(204)
  async rename(@Param(new Zod(tagParamsSchema)) p: { tagId: string }, @Body(new Zod(renameBodySchema)) body: RenameBody) {
    await this.tags.rename(p.tagId, body.name);
  }

  @RequirePermission('tag.delete')
  @Post(R.deleteTag.path)
  @HttpCode(204)
  async delete(@Param(new Zod(tagParamsSchema)) p: { tagId: string }) {
    await this.tags.delete(p.tagId);
  }
}

@Module({ controllers: [TagsController], providers: [TagsService] })
export class TagsModule {}
