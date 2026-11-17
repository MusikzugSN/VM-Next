import * as z from 'zod';
import { idSchema, refSchema } from '../common/ids.schema';
import { voiceRefSchema } from '../common/voice.schema';
import { completenessSummarySchema } from './score-table.schema';

/** GET scores/scores/:scoreId/completeness?ensembleId= – tab „Stimmen & Vollständigkeit“ (N-4, N-9). */
export const scoreCompletenessQuerySchema = z.object({ ensembleId: idSchema.optional() });
export type ScoreCompletenessQuery = z.infer<typeof scoreCompletenessQuerySchema>;

export const scoreCompletenessResponseSchema = z.object({
  ensemble: refSchema.nullable(),
  summary: completenessSummarySchema,
  /** All lineup voices in lineup order. */
  voices: z.array(
    z.object({
      voice: voiceRefSchema,
      status: z.enum(['present', 'substituted', 'missing']),
      sheetId: idSchema.nullable(),
      /** For `substituted`: the substitute voice that covers it. */
      substitute: voiceRefSchema.nullable(),
    }),
  ),
});
export type ScoreCompletenessResponse = z.infer<typeof scoreCompletenessResponseSchema>;
