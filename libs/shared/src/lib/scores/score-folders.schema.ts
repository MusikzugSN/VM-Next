import { z } from 'zod';
import { refSchema } from '../common/ids.schema';

/**
 * GET scores/scores/:scoreId/folders – tab „Mappen & Nummern“ (N-5).
 * Only folders in ensembles where the caller has `folder.view`. Not paginated.
 */
export const scoreFoldersResponseSchema = z.object({
  items: z.array(
    z.object({
      folder: refSchema,
      ensemble: refSchema,
      number: z.string(),
    }),
  ),
});
export type ScoreFoldersResponse = z.infer<typeof scoreFoldersResponseSchema>;
