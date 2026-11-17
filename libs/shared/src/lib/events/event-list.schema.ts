import { z } from 'zod';
import { idSchema, isoDateSchema, refSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';

/**
 * GET events/event-list – events of the ensembles with `event.view` (N-15).
 * `upcoming`: date ≥ today, ascending; `past`: date < today, descending.
 */
export const eventListQuerySchema = cursorQuerySchema.extend({
  period: z.enum(['upcoming', 'past']).default('upcoming'),
  ensembleId: idSchema.optional(),
  q: z.string().trim().max(100).optional(),
});
export type EventListQuery = z.infer<typeof eventListQuerySchema>;

export const eventListItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  date: isoDateSchema,
  ensemble: refSchema,
  showInMyArea: z.boolean(),
  scoreCount: z.number().int(),
});
export type EventListItem = z.infer<typeof eventListItemSchema>;
export const eventListResponseSchema = pageSchema(eventListItemSchema);
export type EventListResponse = z.infer<typeof eventListResponseSchema>;
