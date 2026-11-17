import * as z from 'zod';
import { idSchema, isoDateTimeSchema, queryBoolean, refSchema, shortNameSchema } from '../common/ids.schema';
import { cursorQuerySchema, pageSchema } from '../common/pagination.schema';
import { voiceRefSchema } from '../common/voice.schema';

/** GET system/ensemble-list (S-2) – whole tree in pre-order (parent before children, siblings by name). */
export const ensembleListQuerySchema = cursorQuerySchema.extend({
  includeArchived: queryBoolean.default(false),
});
export type EnsembleListQuery = z.infer<typeof ensembleListQuerySchema>;

export const ensembleListItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  /** `null` only for the root ensemble created on first start (F-3). */
  parentId: idSchema.nullable(),
  /** 0 = root. */
  depth: z.number().int().min(0),
  isRoot: z.boolean(),
  archived: z.boolean(),
  isDefault: z.boolean(),
  memberCount: z.number().int(),
  lineupSize: z.number().int(),
});
export type EnsembleListItem = z.infer<typeof ensembleListItemSchema>;
export const ensembleListResponseSchema = pageSchema(ensembleListItemSchema);
export type EnsembleListResponse = z.infer<typeof ensembleListResponseSchema>;

/** GET system/ensembles/:ensembleId/details (S-2). */
export const ensembleDetailsResponseSchema = ensembleListItemSchema.extend({
  createdAt: isoDateTimeSchema,
  archivedAt: isoDateTimeSchema.nullable(),
});
export type EnsembleDetailsResponse = z.infer<typeof ensembleDetailsResponseSchema>;

/** GET system/ensembles/:ensembleId/lineup – lineup in order (S-2, N-4). Not paginated. */
export const ensembleLineupResponseSchema = z.object({ voices: z.array(voiceRefSchema) });
export type EnsembleLineupResponse = z.infer<typeof ensembleLineupResponseSchema>;

/** GET system/ensembles/:ensembleId/members – also with `member.view` in this ensemble (R-3, R-4). */
export const ensembleMembersQuerySchema = cursorQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
});
export const ensembleMemberSchema = z.object({
  userId: idSchema,
  name: z.string(),
  pictureUrl: z.url().nullable(),
  role: refSchema,
  voices: z.array(voiceRefSchema),
});
export type EnsembleMember = z.infer<typeof ensembleMemberSchema>;
export const ensembleMembersResponseSchema = pageSchema(ensembleMemberSchema);
export type EnsembleMembersResponse = z.infer<typeof ensembleMembersResponseSchema>;

/** POST system/ensembles/create → 201 `{ id }`. Rename: `renameBodySchema`. Archive/unarchive: no body. */
export const createEnsembleBodySchema = z.object({
  name: shortNameSchema,
  /** Every ensemble except the root has a parent (F-3). */
  parentId: idSchema,
  /** Fill the lineup from the shipped template (N-8). */
  applyLineupTemplate: z.boolean().default(true),
});
export type CreateEnsembleBody = z.infer<typeof createEnsembleBodySchema>;

/**
 * POST system/ensembles/:ensembleId/set-parent → 204 (F-3). Not for the root (409 `root-ensemble`);
 * the new parent must not be the ensemble itself or a descendant (409 `invalid-hierarchy`).
 */
export const setParentBodySchema = z.object({ parentId: idSchema });
export type SetParentBody = z.infer<typeof setParentBodySchema>;

/** POST system/ensembles/:ensembleId/set-lineup → 204. Ordered voice ids, no duplicates. */
export const setLineupBodySchema = z.object({ voiceIds: z.array(idSchema).max(300) });
export type SetLineupBody = z.infer<typeof setLineupBodySchema>;

/**
 * POST system/ensembles/:ensembleId/apply-lineup-template → 200 (N-8).
 * Creates missing instruments/voices of the template and replaces the lineup.
 */
export const applyLineupTemplateResponseSchema = z.object({
  createdInstruments: z.number().int(),
  createdVoices: z.number().int(),
  lineupSize: z.number().int(),
});
export type ApplyLineupTemplateResponse = z.infer<typeof applyLineupTemplateResponseSchema>;
