import * as z from 'zod';
import { queryArray } from '../common/ids.schema';
import { voiceRefSchema } from '../common/voice.schema';

/** GET uploads/voice-suggestions?fileName=… – voice proposed from each file name (N-11). */
export const voiceSuggestionsQuerySchema = z.object({
  fileName: queryArray(z.string().min(1).max(255), 50).pipe(z.array(z.string()).min(1)),
});
export type VoiceSuggestionsQuery = z.infer<typeof voiceSuggestionsQuerySchema>;

export const voiceSuggestionsResponseSchema = z.object({
  items: z.array(
    z.object({
      fileName: z.string(),
      /** Best match or `null`; the user confirms before sending (N-11). */
      voice: voiceRefSchema.nullable(),
    }),
  ),
});
export type VoiceSuggestionsResponse = z.infer<typeof voiceSuggestionsResponseSchema>;
