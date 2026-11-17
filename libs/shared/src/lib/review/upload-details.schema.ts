import * as z from 'zod';
import { idSchema, isoDateTimeSchema, refSchema } from '../common/ids.schema';
import { uploadStatusSchema } from '../common/sheet.schema';

/** GET review/uploads/:uploadId/details – review screen (N-12). The PDF comes from `review/uploads/:uploadId/pdf`. */

export const uploadDetailsResponseSchema = z.object({
  uploadId: idSchema,
  fileName: z.string(),
  status: uploadStatusSchema,
  uploadedAt: isoDateTimeSchema,
  uploadedBy: refSchema.nullable(),
  pageCount: z.number().int(),
  score: refSchema.nullable(),
  voice: refSchema.nullable(),
  /** An approved sheet already exists for this score and voice → approve needs `replaceExisting`. */
  existingSheetId: idSchema.nullable(),
  /** Neighbours in the queue for „Annehmen & weiter“ and arrow keys (N-12, N-13). */
  previousUploadId: idSchema.nullable(),
  nextUploadId: idSchema.nullable(),
});
export type UploadDetailsResponse = z.infer<typeof uploadDetailsResponseSchema>;
