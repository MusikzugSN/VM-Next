import { z } from 'zod';
import { idSchema, refSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';

/** GET me/folders – folders released for Mein Bereich in the member's ensembles and their sub-ensembles (R-2, N-15, H-1). */
export const myFoldersQuerySchema = cursorQuerySchema;
export const myFolderItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  ensemble: refSchema,
  scoreCount: z.number().int(),
});
export type MyFolderItem = z.infer<typeof myFolderItemSchema>;
export const myFoldersResponseSchema = pageSchema(myFolderItemSchema);
export type MyFoldersResponse = z.infer<typeof myFoldersResponseSchema>;
