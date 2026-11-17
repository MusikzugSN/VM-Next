import * as z from 'zod';
import { idSchema, isoDateSchema, isoDateTimeSchema, refSchema } from '../common/ids.schema';

/** GET events/events/:eventId/details – header of „Event bearbeiten“ (N-15, N-16). */
export const eventDetailsResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  date: isoDateSchema,
  ensemble: refSchema,
  showInMyArea: z.boolean(),
  updatedAt: isoDateTimeSchema,
});
export type EventDetailsResponse = z.infer<typeof eventDetailsResponseSchema>;
