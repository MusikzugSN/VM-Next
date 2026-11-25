import * as z from 'zod';
import { idSchema, refSchema } from './ids.schema';

/**
 * Ensemble in a selection, in tree order (F-3): parent before children, siblings by name.
 * `depth` counts the shown ancestors (0 = top level of this selection), for indenting.
 */
export const ensembleOptionSchema = refSchema.extend({ depth: z.number().int().min(0) });
export type EnsembleOption = z.infer<typeof ensembleOptionSchema>;

/**
 * GET folders/ensemble-options and GET events/ensemble-options – ensembles in which the caller
 * may create folders resp. events (R-4). GET system/ensemble-options – every active ensemble,
 * for parent selection (S-2). Archived ensembles are excluded. Not paginated.
 */
export const ensembleOptionsResponseSchema = z.object({ items: z.array(ensembleOptionSchema) });
export type EnsembleOptionsResponse = z.infer<typeof ensembleOptionsResponseSchema>;

/** Score candidates for adding to a folder or setlist; `alreadyContained` marks entries already present. */
export const scoreCandidateSchema = z.object({
  id: idSchema,
  title: z.string(),
  composer: z.string().nullable(),
  alreadyContained: z.boolean(),
});
export type ScoreCandidate = z.infer<typeof scoreCandidateSchema>;
