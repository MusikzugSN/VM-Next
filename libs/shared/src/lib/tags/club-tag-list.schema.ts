import * as z from 'zod';
import { idSchema, shortNameSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';

/** GET tags/club-tag-list – club tags sorted by name (N-17). */
export const clubTagListQuerySchema = cursorQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
});
export type ClubTagListQuery = z.infer<typeof clubTagListQuerySchema>;

export const clubTagItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  scoreCount: z.number().int(),
});
export type ClubTagItem = z.infer<typeof clubTagItemSchema>;
export const clubTagListResponseSchema = pageSchema(clubTagItemSchema);
export type ClubTagListResponse = z.infer<typeof clubTagListResponseSchema>;

/** POST tags/club-tags/create → 201 `{ id }`; …/:tagId/rename (`renameBodySchema`) and …/:tagId/delete → 204. */
export const createClubTagBodySchema = z.object({ name: shortNameSchema });
export type CreateClubTagBody = z.infer<typeof createClubTagBodySchema>;
