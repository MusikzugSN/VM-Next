import { z } from 'zod';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';
import { memberScoreRowSchema } from '../common/sheet.schema';
import { voiceContextQuerySchema } from '../common/voice.schema';

/** GET me/events/:eventId/setlist – scores in playing order (M-5), filtered to active voices. */
export const myEventSetlistQuerySchema = cursorQuerySchema.extend(voiceContextQuerySchema.shape);
export type MyEventSetlistQuery = z.infer<typeof myEventSetlistQuerySchema>;

export const myEventSetlistItemSchema = memberScoreRowSchema.extend({
  /** 1-based position in the setlist. */
  position: z.number().int().min(1),
});
export type MyEventSetlistItem = z.infer<typeof myEventSetlistItemSchema>;
export const myEventSetlistResponseSchema = pageSchema(myEventSetlistItemSchema);
export type MyEventSetlistResponse = z.infer<typeof myEventSetlistResponseSchema>;
