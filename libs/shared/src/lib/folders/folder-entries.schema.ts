import { z } from 'zod';
import { idSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';
import { scoreCandidateSchema } from '../common/ensemble-options.schema';

/** Folder number (N-5): free text such as `12`, `12a`, `A3`; sorted naturally. Unique within a folder. */
export const folderNumberSchema = z.string().trim().min(1).max(10);

/** GET folders/folders/:folderId/entries – scores with number, sorted naturally by number (N-5). */
export const folderEntriesQuerySchema = cursorQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
});
export type FolderEntriesQuery = z.infer<typeof folderEntriesQuerySchema>;

export const folderEntrySchema = z.object({
  scoreId: idSchema,
  number: folderNumberSchema,
  title: z.string(),
  composer: z.string().nullable(),
});
export type FolderEntry = z.infer<typeof folderEntrySchema>;
export const folderEntriesResponseSchema = pageSchema(folderEntrySchema);
export type FolderEntriesResponse = z.infer<typeof folderEntriesResponseSchema>;

/** GET folders/folders/:folderId/score-candidates?q= – scores to add (N-5). */
export const folderScoreCandidatesQuerySchema = cursorQuerySchema.extend({
  q: z.string().trim().min(1).max(100),
});
export const folderScoreCandidatesResponseSchema = pageSchema(scoreCandidateSchema).extend({
  /** Proposal for the next free number (highest numeric number + 1). */
  suggestedNumber: z.string().nullable(),
});
export type FolderScoreCandidatesResponse = z.infer<typeof folderScoreCandidatesResponseSchema>;
