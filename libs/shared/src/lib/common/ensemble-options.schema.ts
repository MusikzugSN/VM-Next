import * as z from 'zod';
import { idSchema, refSchema } from './ids.schema';

/**
 * GET folders/ensemble-options and GET events/ensemble-options – ensembles in which the caller
 * may create folders resp. events (R-4). Archived ensembles are excluded. Not paginated.
 */
export const ensembleOptionsResponseSchema = z.object({ items: z.array(refSchema) });
export type EnsembleOptionsResponse = z.infer<typeof ensembleOptionsResponseSchema>;

/** Score candidates for adding to a folder or setlist; `alreadyContained` marks entries already present. */
export const scoreCandidateSchema = z.object({
  id: idSchema,
  title: z.string(),
  composer: z.string().nullable(),
  alreadyContained: z.boolean(),
});
export type ScoreCandidate = z.infer<typeof scoreCandidateSchema>;
