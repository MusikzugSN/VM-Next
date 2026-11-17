import { z } from 'zod';

export const PAGE_LIMIT_DEFAULT = 50;
export const PAGE_LIMIT_MAX = 200;

/** Query parameters of every paginated list endpoint. */
export const cursorQuerySchema = z.object({
  /** Opaque cursor from `nextCursor` of the previous page. */
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
});
export type CursorQuery = z.infer<typeof cursorQuerySchema>;

/** Response envelope of every paginated list endpoint. */
export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    /** `null` when there are no further items. */
    nextCursor: z.string().nullable(),
  });
export type Page<T> = { items: T[]; nextCursor: string | null };

/** Sort direction for sortable lists. */
export const sortDirectionSchema = z.enum(['asc', 'desc']);
