import * as z from 'zod';
import { idSchema, isoDateTimeSchema, refSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';
import { voiceRefSchema } from '../common/voice.schema';

export const userStatusSchema = z.enum(['active', 'blocked']);
export type UserStatus = z.infer<typeof userStatusSchema>;

/** GET system/user-table – users sorted by name (S-1). */
export const userTableQuerySchema = cursorQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: userStatusSchema.optional(),
  ensembleId: idSchema.optional(),
});
export type UserTableQuery = z.infer<typeof userTableQuerySchema>;

export const userRowSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string().nullable(),
  pictureUrl: z.url().nullable(),
  memberships: z.array(z.object({ ensemble: refSchema, role: refSchema })),
  voices: z.array(voiceRefSchema),
  status: userStatusSchema,
  isAdmin: z.boolean(),
  lastLoginAt: isoDateTimeSchema.nullable(),
});
export type UserRow = z.infer<typeof userRowSchema>;
export const userTableResponseSchema = pageSchema(userRowSchema);
export type UserTableResponse = z.infer<typeof userTableResponseSchema>;

/** GET system/users/:userId/details – user page (S-1, A-5, R-1). */
export const userDetailsResponseSchema = userRowSchema.extend({
  createdAt: isoDateTimeSchema,
  /** `false` for the last active admin (cannot be blocked, demoted or deleted). */
  canBeDemoted: z.boolean(),
});
export type UserDetailsResponse = z.infer<typeof userDetailsResponseSchema>;

/** GET system/user-assignment-options – choices for the user page. Not paginated. */
export const userAssignmentOptionsResponseSchema = z.object({
  ensembles: z.array(refSchema),
  roles: z.array(refSchema),
});
export type UserAssignmentOptionsResponse = z.infer<typeof userAssignmentOptionsResponseSchema>;
