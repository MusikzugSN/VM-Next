import * as z from 'zod';
import { idSchema } from '../common/ids.schema';

/**
 * GET me/voice-options – all voices grouped by instrument (N-6) for the voice switcher (M-2),
 * the „Stimmen wählen“ dialog (M-1), the profile, the upload dialog (N-11) and the review screen (N-12).
 * Not paginated: bounded master data.
 */
export const voiceOptionsResponseSchema = z.object({
  groups: z.array(
    z.object({
      instrument: z.object({ id: idSchema, name: z.string() }),
      voices: z.array(z.object({ id: idSchema, name: z.string() })),
    }),
  ),
});
export type VoiceOptionsResponse = z.infer<typeof voiceOptionsResponseSchema>;
