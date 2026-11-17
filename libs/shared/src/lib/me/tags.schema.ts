import * as z from 'zod';
import { idSchema } from '../common/ids.schema';

/**
 * GET me/tags – club tags and own personal tags as filters (M-8).
 * Not paginated: bounded lists; personal tags are only ever the caller's own.
 */
export const myTagItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  /** Number of visible scores (via released folders/events, R-2) with this tag; tags only filter (F-6). */
  scoreCount: z.number().int(),
});
export type MyTagItem = z.infer<typeof myTagItemSchema>;

export const myTagsResponseSchema = z.object({
  clubTags: z.array(myTagItemSchema),
  personalTags: z.array(myTagItemSchema),
});
export type MyTagsResponse = z.infer<typeof myTagsResponseSchema>;
