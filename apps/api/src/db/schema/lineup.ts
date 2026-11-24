import { int, mysqlTable, primaryKey, unique, varchar } from 'drizzle-orm/mysql-core';
import { ensembles } from './ensembles';
import { voices } from './voices';

/** Lineup (Besetzung) of an ensemble – the base for completeness (N-4, S-2, N-8). */
export const ensembleLineupVoices = mysqlTable(
  'ensemble_lineup_voices',
  {
    ensembleId: varchar('ensemble_id', { length: 36 })
      .notNull()
      .references(() => ensembles.id, { onDelete: 'cascade' }),
    voiceId: varchar('voice_id', { length: 36 })
      .notNull()
      .references(() => voices.id, { onDelete: 'restrict' }),
    position: int('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.ensembleId, t.voiceId] }), unique('ensemble_lineup_position_unique').on(t.ensembleId, t.position)],
);
