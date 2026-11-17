import * as z from 'zod';
import { idSchema } from '../common/ids.schema';
import { uploadStatusSchema } from '../common/sheet.schema';

export const UPLOAD_MAX_FILES = 50;
export const UPLOAD_FILE_FIELD = 'files';
export const UPLOAD_META_FIELD = 'meta';

/**
 * POST uploads/sheets/upload – `multipart/form-data` (N-10, N-11, M-9). Requires `sheet.upload` (F-2).
 * Parts: `files` (1..50 PDFs, repeated) and `meta` (JSON string matching this schema, same order as `files`).
 */
export const uploadSheetsMetaSchema = z.object({
  items: z
    .array(
      z.object({
        fileName: z.string().min(1).max(255),
        /** Optional: the review assigns missing values (N-12). */
        scoreId: idSchema.nullable(),
        voiceId: idSchema.nullable(),
      }),
    )
    .min(1)
    .max(UPLOAD_MAX_FILES),
});
export type UploadSheetsMeta = z.infer<typeof uploadSheetsMetaSchema>;

/**
 * 201. With `sheet.approve`, score and voice set and no existing sheet for that score and voice,
 * uploads are approved immediately (N-10, F-11); otherwise they are `pending` („Ungeprüft“).
 */
export const uploadSheetsResponseSchema = z.object({
  items: z.array(
    z.object({
      uploadId: idSchema,
      fileName: z.string(),
      status: uploadStatusSchema,
      /** Set when approved immediately. */
      sheetId: idSchema.nullable(),
      pageCount: z.number().int(),
    }),
  ),
});
export type UploadSheetsResponse = z.infer<typeof uploadSheetsResponseSchema>;
