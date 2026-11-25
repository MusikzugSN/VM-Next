import { Inject, Injectable } from '@nestjs/common';
import type { PrintRule } from '@vm-web/shared';
import { asc, eq } from 'drizzle-orm';

import { DATABASE, type Database, type Tx } from '../db/database';
import { ensemblePrintRules, ensembles } from '../db/schema';

export interface EnsembleNode {
  id: string;
  name: string;
  parentId: string | null;
  isRoot: boolean;
}

export interface PrintRuleRow extends PrintRule {
  ensembleId: string;
}

@Injectable()
export class PrintRulesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  ensembleNodes(): Promise<EnsembleNode[]> {
    return this.db.select({ id: ensembles.id, name: ensembles.name, parentId: ensembles.parentId, isRoot: ensembles.isRoot }).from(ensembles);
  }

  allRules(): Promise<PrintRuleRow[]> {
    return this.db
      .select({ ensembleId: ensemblePrintRules.ensembleId, fromPages: ensemblePrintRules.fromPages, mode: ensemblePrintRules.mode })
      .from(ensemblePrintRules)
      .orderBy(asc(ensemblePrintRules.ensembleId), asc(ensemblePrintRules.fromPages));
  }

  replace(ensembleId: string, rules: readonly PrintRule[]): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      if (!(await this.lockEnsemble(tx, ensembleId))) return false;
      await tx.delete(ensemblePrintRules).where(eq(ensemblePrintRules.ensembleId, ensembleId));
      if (rules.length) await tx.insert(ensemblePrintRules).values(rules.map((r) => ({ ensembleId, fromPages: r.fromPages, mode: r.mode })));
      return true;
    });
  }

  clear(ensembleId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      if (!(await this.lockEnsemble(tx, ensembleId))) return false;
      await tx.delete(ensemblePrintRules).where(eq(ensemblePrintRules.ensembleId, ensembleId));
      return true;
    });
  }

  private async lockEnsemble(tx: Tx, ensembleId: string): Promise<boolean> {
    const [row] = await tx.select({ id: ensembles.id }).from(ensembles).where(eq(ensembles.id, ensembleId)).for('update');
    return !!row;
  }
}
