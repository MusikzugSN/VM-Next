import { z } from 'zod';

/** GET me/upload-summary – start page block „Status eigener Uploads“ (N-14). */
export const uploadSummaryResponseSchema = z.object({
  pending: z.number().int(),
  /** Rejected within the last 30 days. */
  recentlyRejected: z.number().int(),
  /** Approved within the last 30 days. */
  recentlyApproved: z.number().int(),
});
export type UploadSummaryResponse = z.infer<typeof uploadSummaryResponseSchema>;
