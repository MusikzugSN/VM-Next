import * as z from 'zod';
import { idSchema, isoDateSchema, refSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';

/** Event card in Mein Bereich (M-5). */
export const myEventItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  date: isoDateSchema,
  ensemble: refSchema,
  scoreCount: z.number().int(),
});
export type MyEventItem = z.infer<typeof myEventItemSchema>;

/** GET me/upcoming-events – events from today on, ascending by date (M-5). */
export const upcomingEventsQuerySchema = cursorQuerySchema;
export const upcomingEventsResponseSchema = pageSchema(myEventItemSchema);
export type UpcomingEventsResponse = z.infer<typeof upcomingEventsResponseSchema>;
