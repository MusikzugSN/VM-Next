import { z } from 'zod';
import { idSchema } from '../common/ids.schema';
import { voiceContextQuerySchema } from '../common/voice.schema';

/**
 * Which sheets go into a ZIP or print document:
 * - `fallback` (default): own sheets; a substitute only if no own sheet exists (first in substitute order)
 * - `all`: own sheets and all substitutes
 * - `none`: own sheets only
 */
export const substituteModeSchema = z.enum(['fallback', 'all', 'none']);
export type SubstituteMode = z.infer<typeof substituteModeSchema>;

/** GET me/sheets/:sheetId/pdf (M-6) – `application/pdf`, file name „Nr – Titel – Stimme.pdf“. */

export const sheetPdfQuerySchema = z.object({
  /** Folder context for the number in the file name (N-5). */
  folderId: idSchema.optional(),
  /** `inline` for the pdf.js preview, `attachment` for download. */
  disposition: z.enum(['inline', 'attachment']).default('attachment'),
});
export type SheetPdfQuery = z.infer<typeof sheetPdfQuerySchema>;

/** GET me/folders/:folderId/zip and GET me/events/:eventId/zip (M-6) – `application/zip`. */
export const zipQuerySchema = voiceContextQuerySchema.extend({
  substitutes: substituteModeSchema.default('fallback'),
});
export type ZipQuery = z.infer<typeof zipQuerySchema>;

/** POST me/downloads/selection-zip (M-6) – `application/zip` for a selection from any list. */
export const selectionZipBodySchema = z.object({
  scoreIds: z.array(idSchema).min(1).max(200),
  /** Folder context gives numbers in file names; without it file names have no number. */
  folderId: idSchema.optional(),
  eventId: idSchema.optional(),
  voiceIds: z.array(idSchema).max(20).default([]),
  substitutes: substituteModeSchema.default('fallback'),
});
export type SelectionZipBody = z.infer<typeof selectionZipBodySchema>;
