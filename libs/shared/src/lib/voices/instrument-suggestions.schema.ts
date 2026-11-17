import { z } from 'zod';
import { idSchema } from '../common/ids.schema';

/** GET voices/instrument-suggestions?q= – autocomplete for the instrument field (N-7). Max. 20 hits, prefix matches first. */
export const instrumentSuggestionsQuerySchema = z.object({
  q: z.string().trim().max(60).default(''),
});
export type InstrumentSuggestionsQuery = z.infer<typeof instrumentSuggestionsQuerySchema>;

export const instrumentSuggestionsResponseSchema = z.object({
  items: z.array(z.object({ id: idSchema, name: z.string() })).max(20),
});
export type InstrumentSuggestionsResponse = z.infer<typeof instrumentSuggestionsResponseSchema>;
