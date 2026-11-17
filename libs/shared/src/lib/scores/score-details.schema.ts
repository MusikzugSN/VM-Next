import * as z from 'zod';
import { idSchema, isoDateTimeSchema, refSchema } from '../common/ids.schema';
import { customFieldValuesSchema, scoreFixedFieldsSchema } from './score-fields.schema';


/** GET scores/scores/:scoreId/details – tab „Stammdaten“ (N-1, N-2). */
export const scoreDetailsResponseSchema = scoreFixedFieldsSchema.extend({
  id: idSchema,
  customFields: customFieldValuesSchema,
  tags: z.array(refSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type ScoreDetailsResponse = z.infer<typeof scoreDetailsResponseSchema>;

/** POST scores/scores/create → 201 `{ id }` (N-1, N-2). */
export const createScoreBodySchema = scoreFixedFieldsSchema.extend({
  customFields: customFieldValuesSchema.default({}),
  tagIds: z.array(idSchema).max(50).default([]),
});
export type CreateScoreBody = z.infer<typeof createScoreBodySchema>;

/** POST scores/scores/:scoreId/update-details → 204. Replaces fixed fields, custom fields and club tags. */
export const updateScoreDetailsBodySchema = scoreFixedFieldsSchema.extend({
  customFields: customFieldValuesSchema,
  tagIds: z.array(idSchema).max(50),
});
export type UpdateScoreDetailsBody = z.infer<typeof updateScoreDetailsBodySchema>;
