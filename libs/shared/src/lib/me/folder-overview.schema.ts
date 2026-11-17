import * as z from 'zod';
import { idSchema, refSchema } from '../common/ids.schema';

/** GET me/folders/:folderId/overview – folder header (M-4). Query: `voiceContextQuerySchema`. */

export const myFolderOverviewResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  ensemble: refSchema,
  scoreCount: z.number().int(),
  /** Scores without own sheet and without substitute in the active voices (M-3). */
  missingCount: z.number().int(),
  /** Pages of the active voices' sheets in total; used for the print/ZIP buttons (D-2). */
  totalPages: z.number().int(),
});
export type MyFolderOverviewResponse = z.infer<typeof myFolderOverviewResponseSchema>;
