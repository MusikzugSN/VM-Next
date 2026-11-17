import * as z from 'zod';
import { idSchema, isoDateSchema, refSchema } from '../common/ids.schema';

/** GET me/events/:eventId/overview – event header (M-5). Query: `voiceContextQuerySchema`. */

export const myEventOverviewResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  date: isoDateSchema,
  ensemble: refSchema,
  isPast: z.boolean(),
  scoreCount: z.number().int(),
  missingCount: z.number().int(),
  totalPages: z.number().int(),
});
export type MyEventOverviewResponse = z.infer<typeof myEventOverviewResponseSchema>;
