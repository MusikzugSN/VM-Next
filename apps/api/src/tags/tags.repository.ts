import { Inject, Injectable } from '@nestjs/common';
import type { ClubTagListQuery } from '@vm-web/shared';
import { and, asc, eq, like, sql } from 'drizzle-orm';
import type { CursorKey } from '../common/pagination/cursor';
import { afterNameAndId } from '../common/pagination/keyset';
import { likePattern } from '../common/sql';
import { DATABASE, type Database } from '../db/database';
import { withNameTaken } from '../db/db-errors';
import { clubTags } from '../db/schema';

export interface ClubTagListRow {
  id: string;
  name: string;
  scoreCount: number;
  sortKey: string;
}

@Injectable()
export class TagsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  listPage(query: Pick<ClubTagListQuery, 'q' | 'limit'>, cursor: CursorKey | undefined): Promise<ClubTagListRow[]> {
    return this.db
      .select({
        id: clubTags.id,
        name: clubTags.name,
        scoreCount: sql<number>`(select count(*) from score_club_tags x where x.tag_id = ${clubTags.id})`,
        sortKey: sql<string>`lower(${clubTags.name})`,
      })
      .from(clubTags)
      .where(and(query.q ? like(clubTags.name, likePattern(query.q)) : undefined, afterNameAndId(clubTags.name, clubTags.id, cursor)))
      .orderBy(sql`lower(${clubTags.name})`, asc(clubTags.id))
      .limit(query.limit + 1);
  }

  async insert(id: string, name: string): Promise<void> {
    await withNameTaken(() => this.db.insert(clubTags).values({ id, name }));
  }

  async rename(tagId: string, name: string): Promise<boolean> {
    const [result] = await withNameTaken(() => this.db.update(clubTags).set({ name }).where(eq(clubTags.id, tagId)));
    return result.affectedRows > 0;
  }

  async delete(tagId: string): Promise<boolean> {
    const [result] = await this.db.delete(clubTags).where(eq(clubTags.id, tagId));
    return result.affectedRows > 0;
  }
}
