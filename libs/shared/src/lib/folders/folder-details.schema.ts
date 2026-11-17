import * as z from 'zod';
import { idSchema, isoDateTimeSchema, refSchema } from '../common/ids.schema';

/** GET folders/folders/:folderId/details – header of „Mappe bearbeiten“ (N-15). */
export const folderDetailsResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  ensemble: refSchema,
  showInMyArea: z.boolean(),
  scoreCount: z.number().int(),
  updatedAt: isoDateTimeSchema,
});
export type FolderDetailsResponse = z.infer<typeof folderDetailsResponseSchema>;
