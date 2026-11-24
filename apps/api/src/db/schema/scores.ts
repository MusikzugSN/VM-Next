import { bigint, timestamp, int, mysqlTable, text, unique, varchar, type AnyMySqlColumn } from 'drizzle-orm/mysql-core';
import { uploads } from './uploads';
import { users } from './users';
import { voices } from './voices';

/** Scores with fixed fields (N-1); custom field values as rows in `score_field_values` (N-2, D-b). */
export const scores = mysqlTable('scores', {
  id: varchar('id', { length: 36 }).primaryKey(),
  title: text('title').notNull(),
  composer: text('composer'),
  arranger: text('arranger'),
  publisher: text('publisher'),
  publisherNumber: text('publisher_number'),
  durationSeconds: int('duration_seconds'),
  createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { fsp: 6 }).notNull().defaultNow(),
});

/** Approved sheet: one PDF document per score and voice, any number of pages (F-11). */
export const sheets = mysqlTable(
  'sheets',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    scoreId: varchar('score_id', { length: 36 })
      .notNull()
      .references(() => scores.id, { onDelete: 'cascade' }),
    voiceId: varchar('voice_id', { length: 36 })
      .notNull()
      .references(() => voices.id, { onDelete: 'restrict' }),
    fileKey: text('file_key').notNull(),
    pageCount: int('page_count').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    /** The upload this sheet was created from (N-10, N-12). */
    uploadId: varchar('upload_id', { length: 36 }).references((): AnyMySqlColumn => uploads.id, { onDelete: 'set null' }),
    approvedBy: varchar('approved_by', { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [unique('sheets_score_voice_unique').on(t.scoreId, t.voiceId)],
);
