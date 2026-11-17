import { integer, pgTable, primaryKey, unique, uuid } from 'drizzle-orm/pg-core';
import { ensembles } from './ensembles';
import { voices } from './voices';

/** Lineup (Besetzung) of an ensemble – the base for completeness (N-4, S-2, N-8). */
export const ensembleLineupVoices = pgTable(
  'ensemble_lineup_voices',
  {
    ensembleId: uuid('ensemble_id')
      .notNull()
      .references(() => ensembles.id, { onDelete: 'cascade' }),
    voiceId: uuid('voice_id')
      .notNull()
      .references(() => voices.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.ensembleId, t.voiceId] }), unique('ensemble_lineup_position_unique').on(t.ensembleId, t.position)],
);
