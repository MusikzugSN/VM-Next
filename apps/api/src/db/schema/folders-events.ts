import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { ensembles } from './ensembles';
import { scores } from './scores';

/** Folders of an ensemble with switch „in Mein Bereich anzeigen“ (N-15). */
export const folders = pgTable(
  'folders',
  {
    id: uuid('id').primaryKey(),
    ensembleId: uuid('ensemble_id')
      .notNull()
      .references(() => ensembles.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    showInMyArea: boolean('show_in_my_area').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('folders_ensemble_name_idx').on(t.ensembleId, sql`lower(${t.name})`),
    index('folders_ensemble_visible_idx').on(t.ensembleId, t.showInMyArea),
  ],
);

/** Score in a folder with its own number (N-5); `numberSortKey` gives natural order. */
export const folderEntries = pgTable(
  'folder_entries',
  {
    folderId: uuid('folder_id')
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
    scoreId: uuid('score_id')
      .notNull()
      .references(() => scores.id, { onDelete: 'cascade' }),
    number: text('number').notNull(),
    numberSortKey: text('number_sort_key').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.folderId, t.scoreId] }),
    unique('folder_entries_number_unique').on(t.folderId, t.number),
    index('folder_entries_score_idx').on(t.scoreId),
  ],
);

/** Events of an ensemble with date and setlist (N-15, N-16). */
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey(),
    ensembleId: uuid('ensemble_id')
      .notNull()
      .references(() => ensembles.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    showInMyArea: boolean('show_in_my_area').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('events_ensemble_date_idx').on(t.ensembleId, t.date)],
);

/** Setlist in playing order; each score once per event (N-16). */
export const setlistEntries = pgTable(
  'setlist_entries',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    scoreId: uuid('score_id')
      .notNull()
      .references(() => scores.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.scoreId] }),
    unique('setlist_entries_position_unique').on(t.eventId, t.position),
    index('setlist_entries_score_idx').on(t.scoreId),
  ],
);
