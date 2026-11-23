import * as z from 'zod';
import { idSchema } from '../common/ids.schema';
import { MAX_PROFILE_VOICES } from '../me/profile.schema';

/** POST system/users/:userId/set-membership → 204. Creates or changes the membership in one ensemble (R-1). */
export const setMembershipBodySchema = z.object({
  ensembleId: idSchema,
  roleId: idSchema,
});
export type SetMembershipBody = z.infer<typeof setMembershipBodySchema>;

/** POST system/users/:userId/remove-membership → 204. */
export const removeMembershipBodySchema = z.object({ ensembleId: idSchema });
export type RemoveMembershipBody = z.infer<typeof removeMembershipBodySchema>;

/** POST system/users/:userId/set-voices → 204. Pre-assigns profile voices (S-1); empty list allowed. */
export const setUserVoicesBodySchema = z.object({ voiceIds: z.array(idSchema).max(MAX_PROFILE_VOICES) });
export type SetUserVoicesBody = z.infer<typeof setUserVoicesBodySchema>;

/** POST system/users/:userId/set-admin → 204 (R-6). */
export const setAdminBodySchema = z.object({ isAdmin: z.boolean() });
export type SetAdminBody = z.infer<typeof setAdminBodySchema>;

/** POST system/users/:userId/block, …/unblock, …/delete → 204, no body (A-5, Datenschutz). */
