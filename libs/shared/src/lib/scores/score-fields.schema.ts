import * as z from 'zod';
import { idSchema, isoDateSchema } from '../common/ids.schema';

/** Fixed fields of a score (N-1). */
export const scoreFixedFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  composer: z.string().trim().max(200).nullable(),
  arranger: z.string().trim().max(200).nullable(),
  publisher: z.string().trim().max(200).nullable(),
  publisherNumber: z.string().trim().max(100).nullable(),
  /** Duration in seconds. */
  durationSeconds: z.number().int().min(0).max(86_400).nullable(),
});
export type ScoreFixedFields = z.infer<typeof scoreFixedFieldsSchema>;

/**
 * Value of one custom field (N-2). The server checks the value against the field type:
 * text/link → string, number → number, date → ISO date, select → option id,
 * multiselect → option ids, boolean → boolean. `null` = empty.
 */
export const customFieldValueSchema = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  isoDateSchema,
  z.array(idSchema).max(100),
  z.null(),
]);
export type CustomFieldValue = z.infer<typeof customFieldValueSchema>;

/** Custom field values by field id. */
export const customFieldValuesSchema = z.record(idSchema, customFieldValueSchema);
export type CustomFieldValues = z.infer<typeof customFieldValuesSchema>;

/** Sortable / filterable columns: fixed field names or `field:<fieldId>` for custom fields (N-3). */
export const scoreColumnSchema = z.union([
  z.enum(['title', 'composer', 'arranger', 'publisher', 'publisherNumber', 'durationSeconds', 'completeness']),
  z.templateLiteral(['field:', idSchema]),
]);
export type ScoreColumn = z.infer<typeof scoreColumnSchema>;
