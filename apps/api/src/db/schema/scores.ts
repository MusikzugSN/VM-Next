import { bigint, index, integer, jsonb, pgTable, text, timestamp, unique, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { uploads } from './uploads';
import { users } from './users';
import { voices } from './voices';

/** Scores with fixed fields (N-1); custom field values as `{ "<fieldId>": value }` (N-2, D-b). */
export const scores = pgTable(
  'scores',
  {
    id: uuid('id').primaryKey(),
    title: text('title').notNull(),
    composer: text('composer'),
    arranger: text('arranger'),
    publisher: text('publisher'),
    publisherNumber: text('publisher_number'),
    durationSeconds: integer('duration_seconds'),
    customValues: jsonb('custom_values').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // pg_trgm (D-c): substring search in title and composer
    index('scores_title_trgm_idx').using('gin', t.title.op('gin_trgm_ops')),
    index('scores_composer_trgm_idx').using('gin', t.composer.op('gin_trgm_ops')),
    index('scores_custom_values_idx').using('gin', t.customValues),
  ],
);

/** Approved sheet: one PDF document per score and voice, any number of pages (F-11). */
export const sheets = pgTable(
  'sheets',
  {
    id: uuid('id').primaryKey(),
    scoreId: uuid('score_id')
      .notNull()
      .references(() => scores.id, { onDelete: 'cascade' }),
    voiceId: uuid('voice_id')
      .notNull()
      .references(() => voices.id, { onDelete: 'restrict' }),
    fileKey: text('file_key').notNull(),
    pageCount: integer('page_count').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    /** The upload this sheet was created from (N-10, N-12). */
    uploadId: uuid('upload_id').references((): AnyPgColumn => uploads.id, { onDelete: 'set null' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('sheets_score_voice_unique').on(t.scoreId, t.voiceId)],
);
