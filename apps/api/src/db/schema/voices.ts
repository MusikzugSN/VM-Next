import { sql } from 'drizzle-orm';
import { check, timestamp, index, int, mysqlTable, primaryKey, unique, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { users } from './users';

/** Instruments in manually set order (N-6, F-16). */
export const instruments = mysqlTable(
  'instruments',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    position: int('position').notNull(),
    createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('instruments_name_idx').on(sql`lower(${t.name})`)],
);

/** Voices with their full display name, e.g. „Trompete 1 in B“ (N-6). */
export const voices = mysqlTable(
  'voices',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    instrumentId: varchar('instrument_id', { length: 36 })
      .notNull()
      .references(() => instruments.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    /** Order within the instrument (F-16). */
    position: int('position').notNull(),
    createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('voices_name_idx').on(sql`lower(${t.name})`), index('voices_instrument_idx').on(t.instrumentId)],
);

/** Ordered substitutes of a voice (N-9, M-3). */
export const voiceSubstitutes = mysqlTable(
  'voice_substitutes',
  {
    voiceId: varchar('voice_id', { length: 36 })
      .notNull()
      .references(() => voices.id, { onDelete: 'cascade' }),
    substituteVoiceId: varchar('substitute_voice_id', { length: 36 })
      .notNull()
      .references(() => voices.id, { onDelete: 'cascade' }),
    position: int('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.voiceId, t.substituteVoiceId] }),
    unique('voice_substitutes_position_unique').on(t.voiceId, t.position),
    check('voice_substitutes_not_self_check', sql`${t.voiceId} <> ${t.substituteVoiceId}`),
  ],
);

/** Profile voices of a person (M-1, S-1). */
export const userVoices = mysqlTable(
  'user_voices',
  {
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    voiceId: varchar('voice_id', { length: 36 })
      .notNull()
      .references(() => voices.id, { onDelete: 'restrict' }),
    position: int('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.voiceId] })],
);
