import { z } from 'zod';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';
import { myEventItemSchema } from './upcoming-events.schema';

/** GET me/archived-events – past events, descending by date (M-5). */
export const archivedEventsQuerySchema = cursorQuerySchema;
export const archivedEventsResponseSchema = pageSchema(myEventItemSchema);
export type ArchivedEventsResponse = z.infer<typeof archivedEventsResponseSchema>;
