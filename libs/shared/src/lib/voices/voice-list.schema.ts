import * as z from 'zod';
import { idSchema } from '../common/ids.schema';
import { voiceRefSchema } from '../common/voice.schema';

/**
 * GET voices/voice-list – one list grouped by instrument with substitutes (N-6, N-9),
 * instruments and voices in their manually set order (F-16).
 * Not paginated: bounded master data (typically < 150 voices).
 */
export const voiceListResponseSchema = z.object({
  groups: z.array(
    z.object({
      instrument: z.object({ id: idSchema, name: z.string(), voiceCount: z.number().int() }),
      voices: z.array(
        z.object({
          id: idSchema,
          name: z.string(),
          /** Ordered substitute list (N-9). */
          substitutes: z.array(voiceRefSchema),
          sheetCount: z.number().int(),
          /** Number of ensemble lineups containing the voice. */
          lineupCount: z.number().int(),
        }),
      ),
    }),
  ),
});
export type VoiceListResponse = z.infer<typeof voiceListResponseSchema>;
