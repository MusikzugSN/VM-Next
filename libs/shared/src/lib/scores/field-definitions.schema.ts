import * as z from 'zod';
import { idSchema, shortNameSchema } from '../common/ids.schema';

/** Types of custom fields (N-2). */
export const customFieldTypeSchema = z.enum(['text', 'number', 'date', 'select', 'multiselect', 'link', 'boolean']);
export type CustomFieldType = z.infer<typeof customFieldTypeSchema>;

export const fieldOptionSchema = z.object({ id: idSchema, label: z.string().trim().min(1).max(100) });

export const fieldDefinitionSchema = z.object({
  id: idSchema,
  name: z.string(),
  type: customFieldTypeSchema,
  required: z.boolean(),
  position: z.number().int(),
  /** Only for `select` and `multiselect`. */
  options: z.array(fieldOptionSchema),
});
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;

/** GET scores/field-definitions – custom fields in display order (N-2, N-3). Not paginated. */
export const fieldDefinitionsResponseSchema = z.object({ items: z.array(fieldDefinitionSchema) });
export type FieldDefinitionsResponse = z.infer<typeof fieldDefinitionsResponseSchema>;

/** Option input: existing options keep their `id`, new ones come without. */
const fieldOptionInputSchema = z.object({ id: idSchema.optional(), label: z.string().trim().min(1).max(100) });

/** POST scores/field-definitions/create → 201 `{ id }`. Appended at the end. */
export const createFieldBodySchema = z.object({
  name: shortNameSchema,
  type: customFieldTypeSchema,
  required: z.boolean().default(false),
  options: z.array(fieldOptionInputSchema).max(100).default([]),
});
export type CreateFieldBody = z.infer<typeof createFieldBodySchema>;

/** POST scores/field-definitions/:fieldId/update-definition → 204. The type cannot be changed. */
export const updateFieldBodySchema = z.object({
  name: shortNameSchema,
  required: z.boolean(),
  options: z.array(fieldOptionInputSchema).max(100),
});
export type UpdateFieldBody = z.infer<typeof updateFieldBodySchema>;

/** POST scores/field-definitions/reorder → 204. Must contain every field id exactly once. */
export const reorderFieldsBodySchema = z.object({ fieldIds: z.array(idSchema).min(1) });
export type ReorderFieldsBody = z.infer<typeof reorderFieldsBodySchema>;

