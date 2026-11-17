import * as z from 'zod';
import { idSchema } from '../common/ids.schema';
import { pageTransformSchema } from '../common/sheet.schema';

/**
 * POST review/uploads/:uploadId/approve (N-12).
 * `pages` lists the pages to keep in the resulting sheet, in order, with rotation and crop.
 */
export const approveUploadBodySchema = z.object({
  scoreId: idSchema,
  voiceId: idSchema,
  pages: z.array(pageTransformSchema).min(1).max(500),
  /**
   * Replace the existing sheet of the same score and voice (one document per score and voice, F-11).
   * Requires `score.delete` in addition to `sheet.approve`; without the flag 409 `sheet-exists`.
   */
  replaceExisting: z.boolean().default(false),
});
export type ApproveUploadBody = z.infer<typeof approveUploadBodySchema>;

export const approveUploadResponseSchema = z.object({
  sheetId: idSchema,
  /** Next pending upload for „Annehmen & weiter“, `null` if the queue is empty. */
  nextUploadId: idSchema.nullable(),
});
export type ApproveUploadResponse = z.infer<typeof approveUploadResponseSchema>;

/** POST review/uploads/:uploadId/reject (N-12, N-14). */
export const rejectUploadBodySchema = z.object({
  /** Shown to the uploader (N-14); written by the reviewer, not a UI text of the server. */
  reason: z.string().trim().min(1).max(1000),
});
export type RejectUploadBody = z.infer<typeof rejectUploadBodySchema>;

export const rejectUploadResponseSchema = z.object({
  nextUploadId: idSchema.nullable(),
});
export type RejectUploadResponse = z.infer<typeof rejectUploadResponseSchema>;
