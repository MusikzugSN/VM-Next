import { sql, type SQL } from 'drizzle-orm';
import { scores } from '../db/schema';

/** Escapes `%`, `_` and `\` for use in an ILIKE pattern. */
export const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

/** `%q%` for ILIKE with `%`, `_` and `\` escaped. */
export const likePattern = (q: string) => `%${escapeLike(q)}%`;

/** Scores carrying the given club tag. */
export const hasClubTag = (tagId: string): SQL =>
  sql`exists (select 1 from score_club_tags x where x.score_id = ${scores.id} and x.tag_id = ${tagId}::uuid)`;
