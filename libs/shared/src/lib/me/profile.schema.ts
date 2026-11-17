import { z } from 'zod';
import { idSchema, refSchema } from '../common/ids.schema';
import { voiceRefSchema } from '../common/voice.schema';

/** GET me/profile – profile page (M-1, A-4). Name, e-mail and picture are read-only (from the identity server). */
export const profileResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string().nullable(),
  pictureUrl: z.url().nullable(),
  voices: z.array(voiceRefSchema),
  memberships: z.array(z.object({ ensemble: refSchema, role: refSchema })),
  isAdmin: z.boolean(),
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

/** POST me/profile/set-voices – replaces the profile voices (M-1). Response 204. */
export const setMyVoicesBodySchema = z.object({
  voiceIds: z.array(idSchema).min(1).max(20),
});
export type SetMyVoicesBody = z.infer<typeof setMyVoicesBodySchema>;
