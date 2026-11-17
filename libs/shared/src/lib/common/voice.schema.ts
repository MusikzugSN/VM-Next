import { z } from 'zod';
import { idSchema, queryArray } from './ids.schema';

/** Voice as shown everywhere: one name like „Trompete 1 in B“ (N-6). */
export const voiceRefSchema = z.object({
  id: idSchema,
  name: z.string(),
  instrumentId: idSchema,
});
export type VoiceRef = z.infer<typeof voiceRefSchema>;

/**
 * Temporary voice switch (M-2). Without `voiceId` the profile voices are used;
 * with it, only these voices (plus their substitutes, M-3). The profile is not changed.
 */
export const voiceContextQuerySchema = z.object({
  voiceId: queryArray(idSchema, 20),
});
export type VoiceContextQuery = z.infer<typeof voiceContextQuerySchema>;
