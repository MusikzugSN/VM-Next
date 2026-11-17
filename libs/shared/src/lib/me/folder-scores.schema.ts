import * as z from 'zod';
import { idSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';
import { memberScoreRowSchema } from '../common/sheet.schema';
import { voiceContextQuerySchema } from '../common/voice.schema';

/** GET me/folders/:folderId/scores – scores sorted by folder number, filtered to active voices (M-2..M-4, M-8). */
export const myFolderScoresQuerySchema = cursorQuerySchema.extend(voiceContextQuerySchema.shape).extend({
  /** Search in title and composer (M-4). */
  q: z.string().trim().max(100).optional(),
  /** Filter by club tag (M-8). */
  clubTagId: idSchema.optional(),
  /** Filter by own personal tag (M-8). */
  personalTagId: idSchema.optional(),
});
export type MyFolderScoresQuery = z.infer<typeof myFolderScoresQuerySchema>;

export const myFolderScoresResponseSchema = pageSchema(memberScoreRowSchema);
export type MyFolderScoresResponse = z.infer<typeof myFolderScoresResponseSchema>;
