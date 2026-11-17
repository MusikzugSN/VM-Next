import { sql } from 'drizzle-orm';
import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const fieldType = pgEnum('field_type', ['text', 'number', 'date', 'select', 'multiselect', 'link', 'boolean']);

/** Custom fields of scores (N-2, N-3); values live in `scores.custom_values`. */
export const fieldDefinitions = pgTable(
  'field_definitions',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    type: fieldType('type').notNull(),
    required: boolean('required').notNull().default(false),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('field_definitions_name_idx').on(sql`lower(${t.name})`)],
);

/** Options of `select` / `multiselect` fields. */
export const fieldOptions = pgTable(
  'field_options',
  {
    id: uuid('id').primaryKey(),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => fieldDefinitions.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [uniqueIndex('field_options_label_idx').on(t.fieldId, sql`lower(${t.label})`)],
);
