import * as z from 'zod';
import { idSchema, queryArray, refSchema } from '../common/ids.schema';
import { voiceRefSchema } from '../common/voice.schema';
import { substituteModeSchema } from '../me/downloads.schema';
import { printModeSchema, printRulesSchema } from './print-rules.schema';

/**
 * Print scope shared by `print/print-plan` and `print/document` (D-1..D-3, M-7).
 * Exactly the id matching `scope` must be set; `voiceId` works like the voice switch (M-2).
 * Visible: everything from Mein Bereich, plus any score with `score.view`, any folder with `folder.view`
 * and any event with `event.view` in its ensemble (F-9).
 */
export const printQuerySchema = z
  .object({
    scope: z.enum(['score', 'folder', 'event', 'selection']),
    scoreId: idSchema.optional(),
    folderId: idSchema.optional(),
    eventId: idSchema.optional(),
    /** For `selection`; optional `folderId`/`eventId` give context for numbers and order. */
    scoreIds: queryArray(idSchema, 200),
    voiceId: queryArray(idSchema, 20),
    substitutes: substituteModeSchema.default('fallback'),
  })
  .superRefine((q, ctx) => {
    const required = { score: 'scoreId', folder: 'folderId', event: 'eventId', selection: 'scoreIds' } as const;
    const key = required[q.scope];
    const value = q[key];
    if (value === undefined || (Array.isArray(value) && value.length === 0)) {
      ctx.addIssue({ code: 'custom', path: [key], message: 'required-for-scope' });
    }
  });
export type PrintQuery = z.infer<typeof printQuerySchema>;

/** GET print/print-plan – content of the print dialog (D-1, D-2, D-3, M-7). */
export const printPlanResponseSchema = z.object({
  /** Pages of the print-ready PDF including blank pages. */
  totalPages: z.number().int(),
  /** Configured limit for browser printing (D-2, S-4). */
  pageLimit: z.number().int(),
  /** `browser` if totalPages ≤ pageLimit, otherwise `print-service` (D-2, D-3). */
  route: z.enum(['browser', 'print-service']),
  /**
   * Print the job on both sides (D-6): `true` as soon as one score uses a duplex rule; single-sided
   * scores then get a blank back page in the PDF. The print service sets the printer option from it.
   */
  duplex: z.boolean(),
  /** Rules applied (D-6): of `source` (folder/event ensemble or the main ensemble), `null` = shipped default. */
  rules: z.object({ source: refSchema.nullable(), items: printRulesSchema }),
  documents: z.array(
    z.object({
      scoreId: idSchema,
      number: z.string().nullable(),
      title: z.string(),
      voice: voiceRefSchema,
      kind: z.enum(['own', 'substitute']),
      pages: z.number().int(),
      /** Rule for this page count (D-6). */
      mode: printModeSchema,
      /** Sheets of paper for this score. */
      sheets: z.number().int(),
      blankPagesAfter: z.number().int(),
    }),
  ),
  /** Scores without any printable sheet in the chosen voices (M-3). */
  missing: z.array(refSchema),
});
export type PrintPlanResponse = z.infer<typeof printPlanResponseSchema>;
