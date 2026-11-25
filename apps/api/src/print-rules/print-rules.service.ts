import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_PRINT_RULES, type EnsemblePrintRulesResponse, type PrintRule, type Ref } from '@vm-web/shared';

import { appendTo } from '../common/collections';
import { ProblemException } from '../common/problem-details/problem.exception';
import { PrintRulesRepository } from './print-rules.repository';

export interface EffectiveRules {
  rules: PrintRule[];
  source: Ref | null;
}

@Injectable()
export class PrintRulesService {
  constructor(@Inject(PrintRulesRepository) private readonly repo: PrintRulesRepository) {}

  async effective(ensembleId: string | null): Promise<EffectiveRules> {
    const tree = await this.tree();
    const start = ensembleId ?? tree.rootId;
    const { rules, owner } = this.lookup(tree, start);
    return { rules: rules ?? [...DEFAULT_PRINT_RULES], source: owner ? { id: owner, name: tree.nodes.get(owner)?.name ?? '' } : null };
  }

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
    if (!(await this.repo.replace(ensembleId, rules))) throw ProblemException.notFound();
  }

  async reset(ensembleId: string): Promise<void> {
    if (!(await this.repo.clear(ensembleId))) throw ProblemException.notFound();
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
    const [nodes, rows] = await Promise.all([this.repo.ensembleNodes(), this.repo.allRules()]);
    const rules = new Map<string, PrintRule[]>();
    for (const row of rows) appendTo(rules, row.ensembleId, { fromPages: row.fromPages, mode: row.mode });
    return { nodes: new Map(nodes.map((n) => [n.id, n])), rules, rootId: nodes.find((n) => n.isRoot)?.id ?? null };
  }
}

interface Tree {
  nodes: Map<string, { id: string; name: string; parentId: string | null }>;
  rules: Map<string, PrintRule[]>;
  rootId: string | null;
}
