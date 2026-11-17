import * as z from 'zod';
import { idSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';
import { scoreCandidateSchema } from '../common/ensemble-options.schema';

/** GET events/events/:eventId/setlist – setlist in playing order (N-16). */
export const setlistQuerySchema = cursorQuerySchema;

export const setlistEntrySchema = z.object({
  position: z.number().int().min(1),
  scoreId: idSchema,
  title: z.string(),
  composer: z.string().nullable(),
});
export type SetlistEntry = z.infer<typeof setlistEntrySchema>;
export const setlistResponseSchema = pageSchema(setlistEntrySchema);
export type SetlistResponse = z.infer<typeof setlistResponseSchema>;

/** GET events/events/:eventId/score-candidates?q= – scores to add to the setlist. */
export const eventScoreCandidatesQuerySchema = cursorQuerySchema.extend({
  q: z.string().trim().min(1).max(100),
});
export const eventScoreCandidatesResponseSchema = pageSchema(scoreCandidateSchema);
export type EventScoreCandidatesResponse = z.infer<typeof eventScoreCandidatesResponseSchema>;
