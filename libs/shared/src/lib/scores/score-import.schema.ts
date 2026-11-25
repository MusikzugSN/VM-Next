import * as z from 'zod';
import { idSchema, shortNameSchema } from '../common/ids.schema';
import { customFieldTypeSchema } from './field-definitions.schema';

/** Upper limit of rows per import request (N-19). */
export const SCORE_IMPORT_MAX_ROWS = 5000;

/** Fixed score fields a CSV column can be mapped to (N-1, N-19). `duration` is parsed from `m:ss`, `h:mm:ss` or seconds. */
export const scoreImportFixedFieldSchema = z.enum(['title', 'composer', 'arranger', 'publisher', 'publisherNumber', 'duration']);
export type ScoreImportFixedField = z.infer<typeof scoreImportFixedFieldSchema>;

/**
 * What happens with a row (N-19):
 * `create` new score · `link` existing score: add the folder entry, fill only empty fields ·
 * `overwrite` existing score: set all mapped non-empty values · `skip` nothing.
 */
export const scoreImportActionSchema = z.enum(['create', 'link', 'overwrite', 'skip']);
export type ScoreImportAction = z.infer<typeof scoreImportActionSchema>;

/** Key of a custom field created by this import, referenced in `rows[].custom` as `new:<key>`. */
export const scoreImportNewFieldKeySchema = z.string().regex(/^[a-z0-9-]{1,40}$/);
export const SCORE_IMPORT_NEW_FIELD_PREFIX = 'new:';

const cellSchema = z.string().max(5000);

export const scoreImportRowSchema = z.object({
  /** Line in the CSV file (for messages only). */
  line: z.number().int().min(1),
  /** Raw cell values of the mapped fixed fields. */
  fixed: z.partialRecord(scoreImportFixedFieldSchema, cellSchema).default({}),
  /** Raw cell values by custom field id or `new:<key>`. */
  custom: z.record(z.string().max(60), cellSchema).default({}),
  /** Folder entry; folders are looked up by name in `folderEnsembleId` and created when missing. */
  folder: z
    .object({ name: cellSchema, number: cellSchema, numberSuffix: cellSchema.optional() })
    .nullable()
    .default(null),
  /** Chosen in the preview; without it: `create` without a match, `link` with one. */
  action: scoreImportActionSchema.optional(),
});
export type ScoreImportRow = z.infer<typeof scoreImportRowSchema>;

/**
 * POST scores/scores/import (N-19). Requires `score.create` and `score.edit`; with folder entries also
 * `folder.edit` (and `folder.create` for new folders) in `folderEnsembleId`.
 * `dryRun: true` only computes the preview, `false` writes everything in one transaction.
 */
export const scoreImportBodySchema = z.object({
  dryRun: z.boolean(),
  newFields: z
    .array(z.object({ key: scoreImportNewFieldKeySchema, name: shortNameSchema, type: customFieldTypeSchema }))
    .max(50)
    .default([]),
  folderEnsembleId: idSchema.nullable().default(null),
  rows: z.array(scoreImportRowSchema).min(1).max(SCORE_IMPORT_MAX_ROWS),
});
export type ScoreImportBody = z.infer<typeof scoreImportBodySchema>;
export type ScoreImportBodyInput = z.input<typeof scoreImportBodySchema>;

/**
 * Problem in a row. `error` rows are not imported, `warning` rows are imported without the affected part.
 * `target`: `title`, `composer` … , `field:<id>`, `new:<key>` or `folder`.
 * Codes: `required`, `too_big`, `invalid_number`, `invalid_boolean`, `invalid_date`, `invalid_duration`,
 * `invalid_link`, `ambiguous` (several matches, the first is used), `folder-number-missing`,
 * `folder-number-invalid`, `folder-number-suffix-invalid` (suffix longer than one character), `folder-number-taken`, `folder-other-number` (already in the folder with another number).
 */
export const scoreImportIssueSchema = z.object({
  target: z.string(),
  code: z.string(),
  level: z.enum(['error', 'warning']),
});
export type ScoreImportIssue = z.infer<typeof scoreImportIssueSchema>;

export const scoreImportResultRowSchema = z.object({
  line: z.number().int(),
  title: z.string(),
  /** Effective action; rows with an error are reported with their intended action and `failed: true`. */
  action: scoreImportActionSchema,
  failed: z.boolean(),
  /** Existing score with the same title (and composer), or an earlier row of the same file (`inFile`). */
  match: z.object({ id: idSchema, title: z.string(), composer: z.string().nullable(), inFile: z.boolean() }).nullable(),
  folder: z.object({ name: z.string(), number: z.string(), isNew: z.boolean() }).nullable(),
  issues: z.array(scoreImportIssueSchema),
  /** Set after a real import for created, linked and overwritten scores. */
  scoreId: idSchema.nullable(),
});
export type ScoreImportResultRow = z.infer<typeof scoreImportResultRowSchema>;

export const scoreImportResponseSchema = z.object({
  dryRun: z.boolean(),
  rows: z.array(scoreImportResultRowSchema),
  summary: z.object({
    create: z.number().int(),
    link: z.number().int(),
    overwrite: z.number().int(),
    skip: z.number().int(),
    failed: z.number().int(),
    newFolders: z.array(z.string()),
    newOptions: z.number().int(),
  }),
});
export type ScoreImportResponse = z.infer<typeof scoreImportResponseSchema>;
