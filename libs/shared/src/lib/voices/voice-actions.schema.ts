import * as z from 'zod';
import { idSchema, shortNameSchema } from '../common/ids.schema';

/**
 * POST voices/voices/create → 201 `{ id, instrumentId, instrumentCreated }` (N-6, N-7).
 * `instrumentName` is matched case-insensitively; an unknown instrument is created automatically.
 */
export const createVoiceBodySchema = z.object({
  instrumentName: shortNameSchema,
  /** Full display name, e.g. „Trompete 1 in B“. */
  name: shortNameSchema,
});
export type CreateVoiceBody = z.infer<typeof createVoiceBodySchema>;

export const createVoiceResponseSchema = z.object({
  id: idSchema,
  instrumentId: idSchema,
  instrumentCreated: z.boolean(),
});
export type CreateVoiceResponse = z.infer<typeof createVoiceResponseSchema>;

/** POST voices/voices/:voiceId/update-details → 204. Same instrument rule as create. */
export const updateVoiceBodySchema = createVoiceBodySchema;
export type UpdateVoiceBody = z.infer<typeof updateVoiceBodySchema>;

/** Most substitute voices of a voice. */
export const MAX_SUBSTITUTES = 10;

/** POST voices/voices/:voiceId/set-substitutes → 204. Ordered, without the voice itself, no duplicates (N-9). */
export const setSubstitutesBodySchema = z.object({
  substituteVoiceIds: z.array(idSchema).max(MAX_SUBSTITUTES),
});
export type SetSubstitutesBody = z.infer<typeof setSubstitutesBodySchema>;

/** POST voices/instruments/:instrumentId/rename → 204. Body: `renameBodySchema`. */

/** POST voices/instruments/reorder → 204 (F-16). Every instrument id exactly once, in display order. */
export const reorderInstrumentsBodySchema = z.object({ instrumentIds: z.array(idSchema).min(1) });
export type ReorderInstrumentsBody = z.infer<typeof reorderInstrumentsBodySchema>;

/** POST voices/instruments/:instrumentId/reorder-voices → 204 (F-16). Every voice of the instrument exactly once. */
export const reorderVoicesBodySchema = z.object({ voiceIds: z.array(idSchema).min(1) });
export type ReorderVoicesBody = z.infer<typeof reorderVoicesBodySchema>;
