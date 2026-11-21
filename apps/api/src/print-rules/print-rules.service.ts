import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_PRINT_RULES, type EnsemblePrintRulesResponse, type PrintRule, type Ref } from '@vm-web/shared';
import { asc, eq } from 'drizzle-orm';

import { ProblemException } from '../common/problem-details/problem.exception';
import { DATABASE, type Database } from '../db/database';
import { ensemblePrintRules, ensembles } from '../db/schema';

/** Rules in effect and where they come from; `source: null` = shipped default. */
export interface EffectiveRules {
  rules: PrintRule[];
  source: Ref | null;
}

/**
 * Print rules per ensemble (S-2, D-6). An ensemble without own rules uses those of the nearest
 * ancestor with rules (F-3), otherwise `DEFAULT_PRINT_RULES`.
 */
@Injectable()
export class PrintRulesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Rules for printing in an ensemble; `null` = no ensemble context (single score) → main ensemble. */
  async effective(ensembleId: string | null): Promise<EffectiveRules> {
    const tree = await this.tree();
    const start = ensembleId ?? tree.rootId;
    const { rules, owner } = this.lookup(tree, start);
    return { rules: rules ?? [...DEFAULT_PRINT_RULES], source: owner ? { id: owner, name: tree.nodes.get(owner)?.name ?? '' } : null };
  }

  /** GET system/ensembles/:ensembleId/print-rules. */
  async forEnsemble(ensembleId: string): Promise<EnsemblePrintRulesResponse> {
    const tree = await this.tree();
    if (!tree.nodes.has(ensembleId)) throw ProblemException.notFound();
    const { rules, owner } = this.lookup(tree, ensembleId);
    return {
      rules: rules ?? [...DEFAULT_PRINT_RULES],
      own: owner === ensembleId,
      inheritedFrom: owner && owner !== ensembleId ? { id: owner, name: tree.nodes.get(owner)?.name ?? '' } : null,
    };
  }

  async set(ensembleId: string, rules: readonly PrintRule[]): Promise<void> {
    await this.assertEnsemble(ensembleId);
    await this.db.transaction(async (tx) => {
      await tx.delete(ensemblePrintRules).where(eq(ensemblePrintRules.ensembleId, ensembleId));
      await tx.insert(ensemblePrintRules).values(rules.map((r) => ({ ensembleId, fromPages: r.fromPages, mode: r.mode })));
    });
  }

  /** Removes own rules: the ensemble inherits again. */
  async reset(ensembleId: string): Promise<void> {
    await this.assertEnsemble(ensembleId);
    await this.db.delete(ensemblePrintRules).where(eq(ensemblePrintRules.ensembleId, ensembleId));
  }

  private lookup(tree: Tree, start: string | null): { rules: PrintRule[] | null; owner: string | null } {
    const seen = new Set<string>();
    for (let id = start; id && !seen.has(id); id = tree.nodes.get(id)?.parentId ?? null) {
      seen.add(id);
      const rules = tree.rules.get(id);
      if (rules?.length) return { rules, owner: id };
    }
    return { rules: null, owner: null };
  }

  private async tree(): Promise<Tree> {
    const [nodes, rows] = await Promise.all([
      this.db.select({ id: ensembles.id, name: ensembles.name, parentId: ensembles.parentId, isRoot: ensembles.isRoot }).from(ensembles),
      this.db.select().from(ensemblePrintRules).orderBy(asc(ensemblePrintRules.ensembleId), asc(ensemblePrintRules.fromPages)),
    ]);
    const rules = new Map<string, PrintRule[]>();
    for (const row of rows) rules.set(row.ensembleId, [...(rules.get(row.ensembleId) ?? []), { fromPages: row.fromPages, mode: row.mode }]);
    return { nodes: new Map(nodes.map((n) => [n.id, n])), rules, rootId: nodes.find((n) => n.isRoot)?.id ?? null };
  }

  private async assertEnsemble(ensembleId: string): Promise<void> {
    const [row] = await this.db.select({ id: ensembles.id }).from(ensembles).where(eq(ensembles.id, ensembleId));
    if (!row) throw ProblemException.notFound();
  }
}

interface Tree {
  nodes: Map<string, { id: string; name: string; parentId: string | null }>;
  rules: Map<string, PrintRule[]>;
  rootId: string | null;
}
