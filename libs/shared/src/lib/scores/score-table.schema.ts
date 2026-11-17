import * as z from 'zod';
import { idSchema, refSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema, sortDirectionSchema } from '../common/pagination.schema';
import { customFieldValuesSchema, scoreColumnSchema, scoreFixedFieldsSchema } from './score-fields.schema';

/** One filter condition on a fixed or custom column (N-3). */
export const scoreFilterSchema = z.object({
  column: scoreColumnSchema,
  op: z.enum(['contains', 'eq', 'neq', 'lt', 'gt', 'between', 'in', 'empty', 'not-empty']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]).optional(),
});
export type ScoreFilter = z.infer<typeof scoreFilterSchema>;

/**
 * GET scores/score-table – score table of the library (N-1, N-3, N-4).
 * `filter` is a JSON-encoded array of `ScoreFilter` (URL-encoded), conditions are combined with AND.
 */
export const scoreTableQuerySchema = cursorQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  sort: scoreColumnSchema.default('title'),
  dir: sortDirectionSchema.default('asc'),
  filter: z
    .string()
    .max(4000)
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'invalid-json' });
        return z.NEVER;
      }
    })
    .pipe(z.array(scoreFilterSchema).max(20))
    .optional(),
  /** Ensemble whose lineup is the base for completeness (N-4); default: configured default ensemble. */
  ensembleId: idSchema.optional(),
  /** Restrict to scores with this club tag. */
  tagId: idSchema.optional(),
});
export type ScoreTableQuery = z.infer<typeof scoreTableQuerySchema>;

export const completenessSummarySchema = z.object({
  /** Lineup voices covered by an own sheet. */
  present: z.number().int(),
  /** Lineup voices only covered by a substitute (N-9). */
  substituted: z.number().int(),
  /** Number of voices in the lineup. */
  total: z.number().int(),
});
export type CompletenessSummary = z.infer<typeof completenessSummarySchema>;

export const scoreTableRowSchema = scoreFixedFieldsSchema.extend({
  id: idSchema,
  customFields: customFieldValuesSchema,
  tags: z.array(refSchema),
  completeness: completenessSummarySchema,
});
export type ScoreTableRow = z.infer<typeof scoreTableRowSchema>;

export const scoreTableResponseSchema = pageSchema(scoreTableRowSchema).extend({
  /** Ensemble used for completeness. */
  completenessEnsemble: refSchema.nullable(),
  totalCount: z.number().int(),
});
export type ScoreTableResponse = z.infer<typeof scoreTableResponseSchema>;

/**
 * GET scores/score-table/export – same filters as the table without pagination (N-3).
 * `text/csv; charset=utf-8`, separator `;`, file name `stuecke-<yyyy-mm-dd>.csv`.
 */
export const scoreTableExportQuerySchema = scoreTableQuerySchema.omit({ cursor: true, limit: true });
export type ScoreTableExportQuery = z.infer<typeof scoreTableExportQuerySchema>;
