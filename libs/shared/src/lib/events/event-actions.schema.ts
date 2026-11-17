import * as z from 'zod';
import { idSchema, isoDateSchema, shortNameSchema } from '../common/ids.schema';

/** POST events/events/create → 201 `{ id }` (N-15, N-16). Requires `event.create` in `ensembleId`. */
export const createEventBodySchema = z.object({
  ensembleId: idSchema,
  name: shortNameSchema,
  date: isoDateSchema,
  showInMyArea: z.boolean().default(false),
});
export type CreateEventBody = z.infer<typeof createEventBodySchema>;

/** POST events/events/:eventId/update-details → 204. */
export const updateEventDetailsBodySchema = z.object({
  name: shortNameSchema,
  date: isoDateSchema,
});
export type UpdateEventDetailsBody = z.infer<typeof updateEventDetailsBodySchema>;

/** POST events/events/:eventId/set-visibility → 204. Body: `setVisibilityBodySchema` (folders). */

/**
 * POST events/events/:eventId/set-setlist → 204 (N-16).
 * Replaces the whole setlist; order = playing order. A score may appear only once.
 */
export const setSetlistBodySchema = z.object({
  scoreIds: z.array(idSchema).max(200),
});
export type SetSetlistBody = z.infer<typeof setSetlistBodySchema>;
