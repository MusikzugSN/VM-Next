import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/** Instruments in manually set order (N-6, F-16). */
export const instruments = pgTable(
  'instruments',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('instruments_name_idx').on(sql`lower(${t.name})`)],
);

/** Voices with their full display name, e.g. „Trompete 1 in B“ (N-6). */
export const voices = pgTable(
  'voices',
  {
    id: uuid('id').primaryKey(),
    instrumentId: uuid('instrument_id')
      .notNull()
      .references(() => instruments.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    /** Order within the instrument (F-16). */
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('voices_name_idx').on(sql`lower(${t.name})`), index('voices_instrument_idx').on(t.instrumentId)],
);

/** Ordered substitutes of a voice (N-9, M-3). */
export const voiceSubstitutes = pgTable(
  'voice_substitutes',
  {
    voiceId: uuid('voice_id')
      .notNull()
      .references(() => voices.id, { onDelete: 'cascade' }),
    substituteVoiceId: uuid('substitute_voice_id')
      .notNull()
      .references(() => voices.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.voiceId, t.substituteVoiceId] }),
    unique('voice_substitutes_position_unique').on(t.voiceId, t.position),
    check('voice_substitutes_not_self_check', sql`${t.voiceId} <> ${t.substituteVoiceId}`),
  ],
);

/** Profile voices of a person (M-1, S-1). */
export const userVoices = pgTable(
  'user_voices',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    voiceId: uuid('voice_id')
      .notNull()
      .references(() => voices.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.voiceId] })],
);
