import * as z from 'zod';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';
import { memberScoreRowSchema } from '../common/sheet.schema';
import { voiceContextQuerySchema } from '../common/voice.schema';

/**
 * GET me/club-tags/:tagId/scores and GET me/personal-tags/:tagId/scores –
 * scores with the tag, sorted by title, filtered to active voices (M-8). Tags are only filters (F-6):
 * only scores that are visible via a released folder or event (R-2). `number` is always `null`.
 */

export const myTagScoresQuerySchema = cursorQuerySchema.extend(voiceContextQuerySchema.shape).extend({
  q: z.string().trim().max(100).optional(),
});
export type MyTagScoresQuery = z.infer<typeof myTagScoresQuerySchema>;

export const myTagScoresResponseSchema = pageSchema(memberScoreRowSchema);
export type MyTagScoresResponse = z.infer<typeof myTagScoresResponseSchema>;
