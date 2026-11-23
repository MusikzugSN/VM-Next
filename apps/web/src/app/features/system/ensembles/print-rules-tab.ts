import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideRotateCcw, lucideX } from '@ng-icons/lucide';
import { apiUrl, ensemblePrintRulesResponseSchema, printRulesSchema, type PrintMode, type PrintRule } from '@vm-web/shared';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';

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
  imports: [NgIcon, TranslocoPipe, ZardButtonComponent, ZardInputComponent, ZardNativeSelectDirective, PageProblem],
  viewProviders: [provideIcons({ lucidePlus, lucideX, lucideRotateCcw })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  template: `
    @if (data.error()) {
      <vm-page-problem [error]="data.error()" />
    } @else if (data.hasValue()) {
      @let info = data.value();
      <section aria-labelledby="h-print-rules" class="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm md:p-6">
        <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 id="h-print-rules" class="text-lg font-semibold">{{ 'system.printRules.title' | transloco }}</h2>
            <p class="text-muted-foreground">{{ 'system.printRules.hint' | transloco: { name: ensembleName() } }}</p>
          </div>
          @if (canEdit()) {
            <div class="flex flex-col gap-2 md:flex-row">
              @if (info.own) {
                <button z-button zType="outline" type="button" (click)="reset()">
                  <ng-icon name="lucideRotateCcw" aria-hidden="true" />{{ 'system.printRules.reset' | transloco }}
                </button>
              }
              <button z-button type="button" [zDisabled]="!dirty() || !valid()" (click)="save()">{{ 'common.save' | transloco }}</button>
            </div>
          }
        </div>

        <p class="rounded-md bg-muted px-4 py-3 text-[13px]">
          @if (info.own) {
            {{ 'system.printRules.own' | transloco }}
          } @else if (info.inheritedFrom; as parent) {
            {{ 'system.printRules.inherited' | transloco: { name: parent.name } }}
          } @else {
            {{ 'system.printRules.default' | transloco }}
          }
        </p>

        <div class="overflow-x-auto rounded-md border">
          <table class="w-full">
            <thead class="bg-muted text-xs font-medium text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-3 text-start">{{ 'system.printRules.pages' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-start">{{ 'system.printRules.mode' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-start">{{ 'system.printRules.example' | transloco }}</th>
                @if (canEdit()) {
                  <th scope="col" class="w-12 px-4 py-3"><span class="sr-only">{{ 'system.printRules.actions' | transloco }}</span></th>
                }
              </tr>
            </thead>
            <tbody>
              @for (rule of draft(); track $index; let i = $index, first = $first) {
                @let end = ruleEnd(draft(), i);
                <tr class="border-t align-middle">
                  <td class="px-4 py-3">
                    @if (first || !canEdit()) {
                      <span class="font-medium">{{ rangeLabel(rule.fromPages, end) }}</span>
                    } @else {
                      <label class="flex items-center gap-2">
                        <span>{{ 'system.printRules.from' | transloco }}</span>
                        <input
                          z-input
                          type="number"
                          min="2"
                          max="500"
                          inputmode="numeric"
                          class="w-20"
                          [value]="rule.fromPages"
                          (change)="setFrom(i, $any($event.target).valueAsNumber)"
                          [attr.aria-label]="'system.printRules.fromLabel' | transloco: { index: i + 1 }"
                          [attr.aria-invalid]="!validAt(i)"
                        />
                        <span>{{ 'system.printRules.pagesUnit' | transloco }}</span>
                        @if (end !== null) {
                          <span class="text-muted-foreground">({{ 'system.printRules.until' | transloco: { end: end } }})</span>
                        }
                      </label>
                    }
                  </td>
                  <td class="px-4 py-3">
                    @if (canEdit()) {
                      <select
                        z-native-select
                        class="md:w-60"
                        [value]="rule.mode"
                        (change)="setMode(i, $any($event.target).value)"
                        [attr.aria-label]="'system.printRules.modeLabel' | transloco: { range: rangeLabel(rule.fromPages, end) }"
                      >
                        @for (mode of modes; track mode) {
                          <option [value]="mode" [selected]="mode === rule.mode">{{ 'print.modes.' + mode | transloco }}</option>
                        }
                      </select>
                    } @else {
                      {{ 'print.modes.' + rule.mode | transloco }}
                    }
                  </td>
                  <td class="px-4 py-3 text-muted-foreground">
                    @let sample = end ?? rule.fromPages;
                    {{ sampleText(sample, rule.mode) }}
                  </td>
                  @if (canEdit()) {
                    <td class="px-4 py-2">
                      @if (!first) {
                        <button z-button zType="ghost" zSize="icon" type="button" (click)="remove(i)" [attr.aria-label]="'system.printRules.remove' | transloco: { range: rangeLabel(rule.fromPages, end) }">
                          <ng-icon name="lucideX" aria-hidden="true" />
                        </button>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (canEdit()) {
          <button z-button zType="outline" type="button" class="self-start" [zDisabled]="draft().length >= 20" (click)="add()">
            <ng-icon name="lucidePlus" aria-hidden="true" />{{ 'system.printRules.add' | transloco }}
          </button>
          @if (!valid()) {
            <p role="alert" class="text-[13px] text-destructive-ink">{{ 'system.printRules.invalid' | transloco }}</p>
          }
        }
        <p class="text-[13px] text-muted-foreground">{{ 'system.printRules.footnote' | transloco }}</p>
      </section>
    }
  `,
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
      mode: this.transloco.translate(`print.modes.${mode}`),
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
