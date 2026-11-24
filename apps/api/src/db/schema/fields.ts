import { sql } from 'drizzle-orm';
import { boolean, timestamp, index, int, json, mysqlEnum, mysqlTable, primaryKey, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { scores } from './scores';

export const FIELD_TYPES = ['text', 'number', 'date', 'select', 'multiselect', 'link', 'boolean'] as const;

/** Custom fields of scores (N-2, N-3); values live in `score_field_values`. */
export const fieldDefinitions = mysqlTable(
  'field_definitions',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    type: mysqlEnum('type', FIELD_TYPES).notNull(),
    required: boolean('required').notNull().default(false),
    position: int('position').notNull(),
    createdAt: timestamp('created_at', { fsp: 6 }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('field_definitions_name_idx').on(sql`lower(${t.name})`)],
);

/** Options of `select` / `multiselect` fields. */
export const fieldOptions = mysqlTable(
  'field_options',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    fieldId: varchar('field_id', { length: 36 })
      .notNull()
      .references(() => fieldDefinitions.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 255 }).notNull(),
    position: int('position').notNull(),
  },
  (t) => [uniqueIndex('field_options_label_idx').on(t.fieldId, sql`lower(${t.label})`)],
);

/**
 * One row per non-empty custom field value of a score (N-2). Replaces a JSON blob on `scores` so
 * values stay queryable without JSON path operators: `value` holds whatever `custom-fields.ts`
 * normalizes for the field's type (string, number, boolean, or a string array for multiselect).
 */
export const scoreFieldValues = mysqlTable(
  'score_field_values',
  {
    scoreId: varchar('score_id', { length: 36 })
      .notNull()
      .references(() => scores.id, { onDelete: 'cascade' }),
    fieldId: varchar('field_id', { length: 36 })
      .notNull()
      .references(() => fieldDefinitions.id, { onDelete: 'cascade' }),
    value: json('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.scoreId, t.fieldId] }), index('score_field_values_field_idx').on(t.fieldId)],
);
