import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRotateCcw, lucideX } from '@ng-icons/lucide';
import { apiUrl, ensemblePrintRulesResponseSchema, printRulesSchema, type PrintMode, type PrintRule } from '@vm-web/shared';

import { VmButton, VmCard, VmIconButton, VmInput, VmSelect, VmTable } from '@vm-web/ui';

import { ActionRunner } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { pluralKey } from '../../../core/i18n/plural.pipe';
import { PageProblem } from '../../../shared/ui/page-problem';
import { selectOr } from '../../../core/util/resource-value';

/** Sheets for a page count under a mode, for the example column („3 Seiten → 2 Blätter“). */
export function sheetsFor(pages: number, mode: PrintMode): number {
  return mode === 'duplex' ? Math.ceil(pages / 2) : pages;
}

/** Last page a rule covers, `null` = open end („ab 4 Seiten“). */
export function ruleEnd(rules: readonly PrintRule[], index: number): number | null {
  const next = rules[index + 1];
  return next ? next.fromPages - 1 : null;
}

/**
 * Tab „Druck“ of an ensemble (S-2, D-6): how scores land on paper by page count. Own rules or
 * inherited ones (parent ensemble or shipped default); members only see them in the print dialog.
 */
@Component({
  selector: 'vm-print-rules-tab',
  imports: [VmTable, VmCard, NgIcon, TranslocoPipe, VmButton, VmIconButton, VmInput, VmSelect, PageProblem],
  viewProviders: [provideIcons({ lucidePlus, lucideX, lucideRotateCcw })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  templateUrl: './print-rules-tab.html',
})
export class PrintRulesTab {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly transloco = inject(TranslocoService);

  readonly ensembleId = input.required<string>();
  readonly ensembleName = input('');
  readonly canEdit = input(false);

  protected readonly modes: PrintMode[] = ['simplex', 'duplex'];
  protected readonly ruleEnd = ruleEnd;
  protected readonly sheetsFor = sheetsFor;

  protected readonly data = rxResource({
    params: () => this.ensembleId(),
    stream: ({ params }) => this.api.get(apiUrl('system', 'ensemblePrintRules', { ensembleId: params }), ensemblePrintRulesResponseSchema),
  });
  protected readonly draft = signal<PrintRule[]>([]);
  protected readonly valid = computed(() => printRulesSchema.safeParse(this.draft()).success);
  protected readonly dirty = computed(() => {
    const saved = selectOr(this.data, (v) => v.rules, []);
    return JSON.stringify(saved) !== JSON.stringify(this.draft()) || (this.data.hasValue() && !this.data.value().own);
  });

  constructor() {
    effect(() => {
      if (!this.data.hasValue()) return;
      const rules = this.data.value().rules;
      untracked(() => this.draft.set(rules.map((r) => ({ ...r }))));
    });
  }

  /** „3 Seiten → 2 Blätter, Beidseitig, lange Kante“ for the example column. */
  protected sampleText(pages: number, mode: PrintMode): string {
    const sheets = sheetsFor(pages, mode);
    return this.transloco.translate('system.printRules.sample', {
      pages: this.transloco.translate(pluralKey('print.pages', pages), { count: pages }),
      sheets: this.transloco.translate(pluralKey('system.printRules.sheets', sheets), { count: sheets }),
      mode: this.transloco.translate(`system.printRules.modes.${mode}`),
    });
  }

  /** „1 Seite“, „2–3 Seiten“, „ab 4 Seiten“. */
  protected rangeLabel(from: number, end: number | null): string {
    const t = (key: string, params: Record<string, unknown>) => this.transloco.translate(key, params);
    if (end === null) return t('system.printRules.rangeFrom', { from });
    if (end === from) return t(from === 1 ? 'system.printRules.rangeOne' : 'system.printRules.rangeSingle', { from });
    return t('system.printRules.range', { from, end });
  }

  protected validAt(index: number): boolean {
    const rules = this.draft();
    return index === 0 || (Number.isInteger(rules[index].fromPages) && rules[index].fromPages > rules[index - 1].fromPages);
  }

  protected setFrom(index: number, value: number): void {
    this.draft.update((rules) => rules.map((r, i) => (i === index ? { ...r, fromPages: Number.isFinite(value) ? Math.trunc(value) : r.fromPages } : r)));
  }

  protected setMode(index: number, mode: PrintMode): void {
    this.draft.update((rules) => rules.map((r, i) => (i === index ? { ...r, mode } : r)));
  }

  protected add(): void {
    this.draft.update((rules) => {
      const last = rules.at(-1);
      return [...rules, { fromPages: (last?.fromPages ?? 0) + 1, mode: last?.mode === 'duplex' ? 'simplex' : 'duplex' }];
    });
  }

  protected remove(index: number): void {
    this.draft.update((rules) => rules.filter((_, i) => i !== index));
  }

  protected async save(): Promise<void> {
    const parsed = printRulesSchema.safeParse(this.draft());
    if (!parsed.success) return;
    const done = await this.actions.runOnce(
      () => this.api.postVoid(apiUrl('system', 'setPrintRules', { ensembleId: this.ensembleId() }), { rules: parsed.data }),
      { success: { key: 'system.printRules.saved' } },
    );
    if (done) this.data.reload();
  }

  protected async reset(): Promise<void> {
    const done = await this.actions.runOnce(() => this.api.postVoid(apiUrl('system', 'resetPrintRules', { ensembleId: this.ensembleId() })), {
      success: { key: 'system.printRules.resetDone' },
    });
    if (done) this.data.reload();
  }
}
