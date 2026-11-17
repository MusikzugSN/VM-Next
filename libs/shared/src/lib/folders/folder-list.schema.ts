import { z } from 'zod';
import { idSchema, refSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';

/** GET folders/folder-list – folders of the ensembles with `folder.view`, sorted by ensemble, name (N-15). */
export const folderListQuerySchema = cursorQuerySchema.extend({
  ensembleId: idSchema.optional(),
  q: z.string().trim().max(100).optional(),
});
export type FolderListQuery = z.infer<typeof folderListQuerySchema>;

export const folderListItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  ensemble: refSchema,
  showInMyArea: z.boolean(),
  scoreCount: z.number().int(),
});
export type FolderListItem = z.infer<typeof folderListItemSchema>;
export const folderListResponseSchema = pageSchema(folderListItemSchema);
export type FolderListResponse = z.infer<typeof folderListResponseSchema>;
