import { z } from 'zod';
import { idSchema } from './ids.schema';
import { voiceRefSchema } from './voice.schema';

/**
 * A sheet (Notenblatt) of a score as seen by a member (M-2, M-3).
 * `own`: one of the active voices; `substitute`: via the substitute list of an active voice.
 */
export const memberSheetSchema = z.object({
  sheetId: idSchema,
  voice: voiceRefSchema,
  pageCount: z.number().int().min(1),
  kind: z.enum(['own', 'substitute']),
  /** For `substitute`: the active voice this substitute stands in for. */
  substituteFor: voiceRefSchema.nullable(),
});
export type MemberSheet = z.infer<typeof memberSheetSchema>;

/**
 * `available`: at least one own sheet; `substitute-only`: only substitutes; `missing`: „Stimme fehlt“ (M-3).
 */
export const sheetAvailabilitySchema = z.enum(['available', 'substitute-only', 'missing']);
export type SheetAvailability = z.infer<typeof sheetAvailabilitySchema>;

/** Score row in member lists (folder, event, tag). Own sheets first, then substitutes. */
export const memberScoreRowSchema = z.object({
  scoreId: idSchema,
  /** Number within the folder (N-5); `null` outside folders. */
  number: z.string().nullable(),
  title: z.string(),
  composer: z.string().nullable(),
  availability: sheetAvailabilitySchema,
  sheets: z.array(memberSheetSchema),
});
export type MemberScoreRow = z.infer<typeof memberScoreRowSchema>;

/** Upload status (N-10, N-14). */
export const uploadStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type UploadStatus = z.infer<typeof uploadStatusSchema>;

/** Page transformation applied when approving an upload (N-12). Crop values are relative (0..1). */
export const pageTransformSchema = z.object({
  /** 1-based page number in the uploaded PDF. */
  sourcePage: z.number().int().min(1),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  crop: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().gt(0).max(1),
      height: z.number().gt(0).max(1),
    })
    .nullable(),
});
export type PageTransform = z.infer<typeof pageTransformSchema>;
