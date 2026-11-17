import * as z from 'zod';
import { idSchema, refSchema } from '../common/ids.schema';
import { memberSheetSchema, sheetAvailabilitySchema } from '../common/sheet.schema';

/**
 * GET me/scores/:scoreId/overview – score page in Mein Bereich (M-3, M-6, M-8, M-9).
 * Query: `voiceContextQuerySchema`. 404 if the score is in no released folder/event of the member (R-2, F-6).
 */

export const myScoreOverviewResponseSchema = z.object({
  id: idSchema,
  title: z.string(),
  composer: z.string().nullable(),
  arranger: z.string().nullable(),
  availability: sheetAvailabilitySchema,
  /** Own sheets first, then substitutes (M-3). */
  sheets: z.array(memberSheetSchema),
  /** Active voices without own sheet → „Fehlende Stimme hochladen“ (M-9). */
  missingVoices: z.array(refSchema),
  clubTags: z.array(refSchema),
  personalTags: z.array(refSchema),
});
export type MyScoreOverviewResponse = z.infer<typeof myScoreOverviewResponseSchema>;
