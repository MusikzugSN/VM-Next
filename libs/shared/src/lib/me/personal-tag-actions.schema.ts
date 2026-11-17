import * as z from 'zod';
import { idSchema, shortNameSchema } from '../common/ids.schema';

/** POST me/personal-tags/create (M-8) → 201 `createdResponseSchema`. */
export const createPersonalTagBodySchema = z.object({ name: shortNameSchema });
export type CreatePersonalTagBody = z.infer<typeof createPersonalTagBodySchema>;

/** POST me/personal-tags/:tagId/rename → 204. */
export const renamePersonalTagBodySchema = z.object({ name: shortNameSchema });
export type RenamePersonalTagBody = z.infer<typeof renamePersonalTagBodySchema>;

/** POST me/personal-tags/:tagId/delete → 204. No body. */

/** POST me/scores/:scoreId/add-personal-tag and …/remove-personal-tag → 204. */
export const personalTagAssignmentBodySchema = z.object({ tagId: idSchema });
export type PersonalTagAssignmentBody = z.infer<typeof personalTagAssignmentBodySchema>;
