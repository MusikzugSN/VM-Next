import { z } from 'zod';
import { refSchema } from '../common/ids.schema';

/** GET scores/ensemble-options – ensembles with a lineup for the completeness selector (N-4). Not paginated. */
export const scoreEnsembleOptionsResponseSchema = z.object({
  items: z.array(refSchema),
  defaultEnsembleId: z.string().nullable(),
});
export type ScoreEnsembleOptionsResponse = z.infer<typeof scoreEnsembleOptionsResponseSchema>;

/** GET scores/tag-options – club tags for the score form (N-17). Not paginated. */
export const scoreTagOptionsResponseSchema = z.object({ items: z.array(refSchema) });
export type ScoreTagOptionsResponse = z.infer<typeof scoreTagOptionsResponseSchema>;
