import { z } from 'zod';
import { voiceRefSchema } from '../common/voice.schema';

/**
 * GET me/voice-context?voiceId= – header block (M-1, M-2, M-3).
 * Query: `voiceContextQuerySchema` from common.
 */
export const voiceContextResponseSchema = z.object({
  profileVoices: z.array(voiceRefSchema),
  /** Voices used for all `me` lists: profile voices or the temporary override. */
  activeVoices: z.array(voiceRefSchema),
  /** `true` if `voiceId` overrides the profile (M-2). */
  isOverride: z.boolean(),
  /** Substitutes of the active voices in priority order (M-3, N-9). */
  substituteVoices: z.array(voiceRefSchema),
  /** No profile voice yet → frontend opens „Stimmen wählen“ (M-1). */
  needsVoiceSelection: z.boolean(),
});
export type VoiceContextResponse = z.infer<typeof voiceContextResponseSchema>;
