import * as z from 'zod';
import { idSchema, isoDateTimeSchema, refSchema } from '../common/ids.schema';
import { voiceRefSchema } from '../common/voice.schema';

/** GET scores/scores/:scoreId/sheets – all approved sheets of a score, grouped order by instrument (N-6). Not paginated. */
export const scoreSheetsResponseSchema = z.object({
  items: z.array(
    z.object({
      sheetId: idSchema,
      voice: voiceRefSchema,
      pageCount: z.number().int(),
      approvedAt: isoDateTimeSchema,
      uploadedBy: refSchema.nullable(),
    }),
  ),
  /** Pending uploads for this score (link to review). */
  pendingUploadCount: z.number().int(),
});
export type ScoreSheetsResponse = z.infer<typeof scoreSheetsResponseSchema>;

/** GET scores/sheets/:sheetId/pdf – `application/pdf` (preview with pdf.js). Query: disposition. */
export const librarySheetPdfQuerySchema = z.object({
  disposition: z.enum(['inline', 'attachment']).default('inline'),
});

