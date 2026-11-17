import * as z from 'zod';
import { idSchema, isoDateTimeSchema, refSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';

/** GET review/queue – pending uploads, oldest first (N-12). */
export const reviewQueueQuerySchema = cursorQuerySchema;

export const reviewQueueItemSchema = z.object({
  uploadId: idSchema,
  fileName: z.string(),
  uploadedAt: isoDateTimeSchema,
  uploadedBy: refSchema.nullable(),
  pageCount: z.number().int(),
  score: refSchema.nullable(),
  voice: refSchema.nullable(),
});
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export const reviewQueueResponseSchema = pageSchema(reviewQueueItemSchema).extend({
  totalPending: z.number().int(),
});
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;
