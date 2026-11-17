import { z } from 'zod';
import { idSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';

/**
 * GET uploads/score-search?q= – score picker in the upload dialog (N-11) and the review screen (N-12).
 * Requires `sheet.upload` or `sheet.approve` (F-2). With `score.view` or `sheet.approve` all scores,
 * otherwise only scores visible in Mein Bereich (R-2).
 */
export const scoreSearchQuerySchema = cursorQuerySchema.extend({
  q: z.string().trim().min(1).max(100),
});
export type ScoreSearchQuery = z.infer<typeof scoreSearchQuerySchema>;

export const scoreSearchItemSchema = z.object({
  id: idSchema,
  title: z.string(),
  composer: z.string().nullable(),
  arranger: z.string().nullable(),
});
export type ScoreSearchItem = z.infer<typeof scoreSearchItemSchema>;
export const scoreSearchResponseSchema = pageSchema(scoreSearchItemSchema);
export type ScoreSearchResponse = z.infer<typeof scoreSearchResponseSchema>;
