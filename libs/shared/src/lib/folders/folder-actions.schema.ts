import * as z from 'zod';
import { idSchema, shortNameSchema } from '../common/ids.schema';
import { folderNumberSchema } from './folder-entries.schema';

/** POST folders/folders/create → 201 `{ id }` (N-15). Requires `folder.create` in `ensembleId`. */
export const createFolderBodySchema = z.object({
  ensembleId: idSchema,
  name: shortNameSchema,
  showInMyArea: z.boolean().default(false),
});
export type CreateFolderBody = z.infer<typeof createFolderBodySchema>;

/** POST folders/folders/:folderId/rename → 204. Body: `renameBodySchema`. */

/** POST folders/folders/:folderId/set-visibility → 204 (N-15). Also used by events. */
export const setVisibilityBodySchema = z.object({ showInMyArea: z.boolean() });
export type SetVisibilityBody = z.infer<typeof setVisibilityBodySchema>;

/** POST folders/folders/:folderId/add-score and …/set-score-number → 204 (N-5). */
export const folderScoreNumberBodySchema = z.object({
  scoreId: idSchema,
  number: folderNumberSchema,
});
export type FolderScoreNumberBody = z.infer<typeof folderScoreNumberBodySchema>;

/** POST folders/folders/:folderId/remove-score → 204. */
export const folderRemoveScoreBodySchema = z.object({ scoreId: idSchema });
export type FolderRemoveScoreBody = z.infer<typeof folderRemoveScoreBodySchema>;
