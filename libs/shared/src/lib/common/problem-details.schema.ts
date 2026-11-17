import * as z from 'zod';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
export const PROBLEM_TYPE_PREFIX = 'urn:vm-web:problem:';

/**
 * Machine-readable problem codes. The frontend maps them to i18n texts;
 * `type` is always `PROBLEM_TYPE_PREFIX + code`.
 */
export const problemCodeSchema = z.enum([
  'validation-failed',
  'unauthenticated',
  'account-blocked',
  'csrf-invalid',
  'forbidden',
  'not-found',
  'conflict',
  'name-taken',
  'in-use',
  'sheet-exists',
  'last-admin',
  'not-default-role',
  'upload-not-pending',
  'root-ensemble',
  'invalid-hierarchy',
  'unsupported-media-type',
  'payload-too-large',
  'login-failed',
  'internal-error',
]);
export type ProblemCode = z.infer<typeof problemCodeSchema>;

/** Single validation issue; `path` is a JSON Pointer into query, params or body. */
export const validationErrorSchema = z.object({
  /** e.g. `/body/items/0/voiceId` or `/query/limit` */
  path: z.string(),
  /** Zod issue code, e.g. `invalid_type`, `too_big`, `invalid_format`. */
  code: z.string(),
});
export type ValidationError = z.infer<typeof validationErrorSchema>;

/** RFC 9457 Problem Details. */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  /** Same as the suffix of `type`, for convenient i18n lookup. */
  code: problemCodeSchema,
  errors: z.array(validationErrorSchema).optional(),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
