import { sql } from 'drizzle-orm';
import { index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { scores } from './scores';
import { users } from './users';

/** Club tags maintained by librarians (N-17); in Mein Bereich only filters (M-8, F-6). */
export const clubTags = pgTable(
  'club_tags',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('club_tags_name_idx').on(sql`lower(${t.name})`)],
);

export const scoreClubTags = pgTable(
  'score_club_tags',
  {
    scoreId: uuid('score_id')
      .notNull()
      .references(() => scores.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => clubTags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.scoreId, t.tagId] }), index('score_club_tags_tag_idx').on(t.tagId)],
);

/** Personal tags, only visible to their owner (M-8). */
export const personalTags = pgTable(
  'personal_tags',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('personal_tags_user_name_idx').on(t.userId, sql`lower(${t.name})`)],
);

export const scorePersonalTags = pgTable(
  'score_personal_tags',
  {
    personalTagId: uuid('personal_tag_id')
      .notNull()
      .references(() => personalTags.id, { onDelete: 'cascade' }),
    scoreId: uuid('score_id')
      .notNull()
      .references(() => scores.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.personalTagId, t.scoreId] }), index('score_personal_tags_score_idx').on(t.scoreId)],
);
