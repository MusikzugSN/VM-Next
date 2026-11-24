import { sql } from 'drizzle-orm';
import { check, int, mysqlTable, primaryKey, text, varchar } from 'drizzle-orm/mysql-core';

import { ensembles } from './ensembles';

/**
 * Print rules of an ensemble (S-2, D-6): „ab `from_pages` Seiten → `mode`“. Ensembles without rows
 * inherit from their parent; without any, the shipped default applies (`DEFAULT_PRINT_RULES`).
 */
export const ensemblePrintRules = mysqlTable(
  'ensemble_print_rules',
  {
    ensembleId: varchar('ensemble_id', { length: 36 })
      .notNull()
      .references(() => ensembles.id, { onDelete: 'cascade' }),
    fromPages: int('from_pages').notNull(),
    mode: text('mode', { enum: ['simplex', 'duplex'] }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ensembleId, t.fromPages] }),
    check('ensemble_print_rules_from_check', sql`${t.fromPages} >= 1`),
    check('ensemble_print_rules_mode_check', sql`${t.mode} in ('simplex', 'duplex')`),
  ],
);
