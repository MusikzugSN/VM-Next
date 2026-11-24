import { sql } from 'drizzle-orm';
import { timestamp, index, mysqlTable, primaryKey, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { scores } from './scores';
import { users } from './users';

/** Club tags maintained by librarians (N-17); in Mein Bereich only filters (M-8, F-6). */
export const clubTags = mysqlTable(
  'club_tags',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('club_tags_name_idx').on(sql`lower(${t.name})`)],
);

export const scoreClubTags = mysqlTable(
  'score_club_tags',
  {
    scoreId: varchar('score_id', { length: 36 })
      .notNull()
      .references(() => scores.id, { onDelete: 'cascade' }),
    tagId: varchar('tag_id', { length: 36 })
      .notNull()
      .references(() => clubTags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.scoreId, t.tagId] }), index('score_club_tags_tag_idx').on(t.tagId)],
);

/** Personal tags, only visible to their owner (M-8). */
export const personalTags = mysqlTable(
  'personal_tags',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('personal_tags_user_name_idx').on(t.userId, sql`lower(${t.name})`)],
);

export const scorePersonalTags = mysqlTable(
  'score_personal_tags',
  {
    personalTagId: varchar('personal_tag_id', { length: 36 })
      .notNull()
      .references(() => personalTags.id, { onDelete: 'cascade' }),
    scoreId: varchar('score_id', { length: 36 })
      .notNull()
      .references(() => scores.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.personalTagId, t.scoreId] }), index('score_personal_tags_score_idx').on(t.scoreId)],
);
