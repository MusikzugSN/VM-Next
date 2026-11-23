import type { Permission, ScoreCandidate } from '@vm-web/shared';
import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import type { AccessContext } from '../access/access-context';
import { ProblemException } from '../common/problem-details/problem.exception';
import { activeEnsembleOptions } from '../common/ensemble-tree';
import type { Database } from '../db/database';
import { afterNameAndId } from '../common/pagination/keyset';
import { ensembles, scores, roles } from '../db/schema';
import { likePattern } from '../common/sql';

/** Non-archived ensembles in which the caller holds `permission` (incl. inherited, F-3), in tree order; 403 if none. */
export async function ensembleOptions(db: Database, access: AccessContext, permission: Permission) {
  const ids = access.ensemblesWith(permission);
  if (!ids.length) throw ProblemException.forbidden();
  return activeEnsembleOptions(db, ids);
}

/** New folders/events only in existing, non-archived ensembles. */
export async function assertActiveEnsemble(db: Database, ensembleId: string, path = '/body/ensembleId'): Promise<void> {
  const [row] = await db.select({ archivedAt: ensembles.archivedAt }).from(ensembles).where(eq(ensembles.id, ensembleId));
  if (!row) throw ProblemException.notFound('Unknown ensemble');
  if (row.archivedAt) throw ProblemException.validation([{ path, code: 'archived' }]);
}

export async function assertRoleExists(db: Database, roleId: string): Promise<void> {
  const [row] = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId));
  if (!row) throw ProblemException.notFound('Unknown role');
}

/** All roles by name, for selection lists. */
export function roleOptions(db: Database): Promise<{ id: string; name: string }[]> {
  return db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(sql`lower(${roles.name})`);
}

/**
 * Score search for adding to a folder or setlist (title, composer), sorted by title.
 * `containedSql` marks scores already present.
 */
export async function scoreCandidates(
  db: Database,
  q: string,
  containedSql: SQL<boolean>,
  cursor: readonly (string | number | null)[] | undefined,
  limit: number,
): Promise<(ScoreCandidate & { sortKey: string })[]> {
  const pattern = likePattern(q);
  return db
    .select({
      id: scores.id,
      title: scores.title,
      composer: scores.composer,
      alreadyContained: containedSql,
      sortKey: sql<string>`lower(${scores.title})`,
    })
    .from(scores)
    .where(
      and(
        sql`(${scores.title} ilike ${pattern} or ${scores.composer} ilike ${pattern})`,
        afterNameAndId(scores.title, scores.id, cursor),
      ),
    )
    .orderBy(sql`lower(${scores.title})`, asc(scores.id))
    .limit(limit + 1);
}

/** Ensembles for list filters: the permitted ones, optionally narrowed to one (empty if not permitted). */
export function listEnsembles(access: AccessContext, permission: Permission, ensembleId: string | undefined): string[] {
  const ids = access.ensemblesWith(permission);
  return ensembleId ? ids.filter((id) => id === ensembleId) : ids;
}
