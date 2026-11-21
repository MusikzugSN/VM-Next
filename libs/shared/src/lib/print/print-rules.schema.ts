import * as z from 'zod';
import { refSchema } from '../common/ids.schema';

/** How a score lands on paper (D-6): one page per sheet, or both sides of the sheet (long edge). */
export const printModeSchema = z.enum(['simplex', 'duplex']);
export type PrintMode = z.infer<typeof printModeSchema>;

/** „ab `fromPages` Seiten → `mode`“; a rule applies up to the next rule's `fromPages` − 1. */
export const printRuleSchema = z.object({
  fromPages: z.number().int().min(1).max(500),
  mode: printModeSchema,
});
export type PrintRule = z.infer<typeof printRuleSchema>;

/** Complete rule set: starts at 1 page, ascending, no gaps by construction. */
export const printRulesSchema = z
  .array(printRuleSchema)
  .min(1)
  .max(20)
  .superRefine((rules, ctx) => {
    if (rules[0] && rules[0].fromPages !== 1) ctx.addIssue({ code: 'custom', path: [0, 'fromPages'], message: 'must-start-at-1' });
    for (let i = 1; i < rules.length; i++) {
      if (rules[i].fromPages <= rules[i - 1].fromPages) ctx.addIssue({ code: 'custom', path: [i, 'fromPages'], message: 'must-ascend' });
    }
  });

/** Shipped default when neither the ensemble nor an ancestor has own rules: single pages simplex, the rest duplex. */
export const DEFAULT_PRINT_RULES: readonly PrintRule[] = [
  { fromPages: 1, mode: 'simplex' },
  { fromPages: 2, mode: 'duplex' },
];

/** The rule for a page count. */
export function printModeFor(pages: number, rules: readonly PrintRule[]): PrintMode {
  let mode: PrintMode = rules[0]?.mode ?? 'duplex';
  for (const rule of rules) if (pages >= rule.fromPages) mode = rule.mode;
  return mode;
}

/**
 * GET system/ensembles/:ensembleId/print-rules (S-2, D-6): the rules in effect for the ensemble.
 * `own` = set on this ensemble; otherwise inherited from `inheritedFrom` (an ancestor) or, if that is
 * `null`, the shipped default.
 */
export const ensemblePrintRulesResponseSchema = z.object({
  rules: printRulesSchema,
  own: z.boolean(),
  inheritedFrom: refSchema.nullable(),
});
export type EnsemblePrintRulesResponse = z.infer<typeof ensemblePrintRulesResponseSchema>;

/** POST system/ensembles/:ensembleId/set-print-rules → 204. POST …/reset-print-rules → 204 (inherit again). */
export const setPrintRulesBodySchema = z.object({ rules: printRulesSchema });
export type SetPrintRulesBody = z.infer<typeof setPrintRulesBodySchema>;
