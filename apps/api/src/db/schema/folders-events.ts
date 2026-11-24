import { sql } from 'drizzle-orm';
import { boolean, date, timestamp, index, int, mysqlTable, primaryKey, unique, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { ensembles } from './ensembles';
import { scores } from './scores';

/** Folders of an ensemble with switch „in Mein Bereich anzeigen“ (N-15). */
export const folders = mysqlTable(
  'folders',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    ensembleId: varchar('ensemble_id', { length: 36 })
      .notNull()
      .references(() => ensembles.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    showInMyArea: boolean('show_in_my_area').notNull().default(false),
    createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('folders_ensemble_name_idx').on(t.ensembleId, sql`lower(${t.name})`),
    index('folders_ensemble_visible_idx').on(t.ensembleId, t.showInMyArea),
  ],
);

/** Score in a folder with its own number (N-5); `numberSortKey` gives natural order. */
export const folderEntries = mysqlTable(
  'folder_entries',
  {
    folderId: varchar('folder_id', { length: 36 })
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
    scoreId: varchar('score_id', { length: 36 })
      .notNull()
      .references(() => scores.id, { onDelete: 'cascade' }),
    number: varchar('number', { length: 255 }).notNull(),
    numberSortKey: varchar('number_sort_key', { length: 255 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.folderId, t.scoreId] }),
    unique('folder_entries_number_unique').on(t.folderId, t.number),
    index('folder_entries_score_idx').on(t.scoreId),
  ],
);

/** Events of an ensemble with date and setlist (N-15, N-16). */
export const events = mysqlTable(
  'events',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    ensembleId: varchar('ensemble_id', { length: 36 })
      .notNull()
      .references(() => ensembles.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    showInMyArea: boolean('show_in_my_area').notNull().default(false),
    createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [index('events_ensemble_date_idx').on(t.ensembleId, t.date)],
);

/** Setlist in playing order; each score once per event (N-16). */
export const setlistEntries = mysqlTable(
  'setlist_entries',
  {
    eventId: varchar('event_id', { length: 36 })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    scoreId: varchar('score_id', { length: 36 })
      .notNull()
      .references(() => scores.id, { onDelete: 'cascade' }),
    position: int('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.scoreId] }),
    unique('setlist_entries_position_unique').on(t.eventId, t.position),
    index('setlist_entries_score_idx').on(t.scoreId),
  ],
);
