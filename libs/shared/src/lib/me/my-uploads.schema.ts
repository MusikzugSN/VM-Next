import { z } from 'zod';
import { idSchema, isoDateTimeSchema, refSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';
import { uploadStatusSchema } from '../common/sheet.schema';

/** GET me/my-uploads – own uploads, newest first (N-14). */
export const myUploadsQuerySchema = cursorQuerySchema.extend({
  status: uploadStatusSchema.optional(),
});
export type MyUploadsQuery = z.infer<typeof myUploadsQuerySchema>;

export const myUploadItemSchema = z.object({
  id: idSchema,
  fileName: z.string(),
  uploadedAt: isoDateTimeSchema,
  status: uploadStatusSchema,
  score: refSchema.nullable(),
  voice: refSchema.nullable(),
  /** Free text written by the reviewer (N-12), only for `rejected`. */
  rejectionReason: z.string().nullable(),
  decidedAt: isoDateTimeSchema.nullable(),
});
export type MyUploadItem = z.infer<typeof myUploadItemSchema>;
export const myUploadsResponseSchema = pageSchema(myUploadItemSchema);
export type MyUploadsResponse = z.infer<typeof myUploadsResponseSchema>;
