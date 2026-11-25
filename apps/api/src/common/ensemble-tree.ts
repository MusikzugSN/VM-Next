import type { EnsembleOption } from '@vm-web/shared';
import { sql } from 'drizzle-orm';

import type { Database } from '../db/database';
import { ensembles } from '../db/schema';
import { appendTo } from './collections';

interface TreeNode {
  id: string;
  name: string;
  parentId: string | null;
}

/**
 * Ensembles for a selection in tree order (F-3): parent before children, siblings by name.
 * Only nodes passing `include` are returned; `depth` counts their included ancestors, so a
 * selection without the root still starts at depth 0.
 */
export function inTreeOrder(all: readonly TreeNode[], include: (node: TreeNode) => boolean): EnsembleOption[] {
  const byParent = new Map<string | null, TreeNode[]>();
  for (const node of all) appendTo(byParent, node.parentId, node);
  const known = new Set(all.map((n) => n.id));
  const result: EnsembleOption[] = [];
  const walk = (parentId: string | null, depth: number) => {
    const children = [...(byParent.get(parentId) ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    for (const node of children) {
      const shown = include(node);
      if (shown) result.push({ id: node.id, name: node.name, depth });
      walk(node.id, shown ? depth + 1 : depth);
    }
  };
  walk(null, 0);
  // Orphans (parent unknown) cannot occur with the FK, but never drop an ensemble silently.
  for (const node of all) if (node.parentId !== null && !known.has(node.parentId) && include(node)) result.push({ id: node.id, name: node.name, depth: 0 });
  return result;
}

/** Active (not archived) ensembles in tree order, optionally restricted to `ids`. */
export async function activeEnsembleOptions(db: Database, ids?: readonly string[]): Promise<EnsembleOption[]> {
  const rows = await db
    .select({ id: ensembles.id, name: ensembles.name, parentId: ensembles.parentId, archived: sql<boolean>`${ensembles.archivedAt} is not null` })
    .from(ensembles);
  const allowed = ids ? new Set(ids) : null;
  return inTreeOrder(rows, (node) => {
    const row = node as (typeof rows)[number];
    return !row.archived && (!allowed || allowed.has(row.id));
  });
}

