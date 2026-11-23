import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { FieldDefinition } from '@vm-web/shared';

import { VmButton } from '@vm-web/ui';
import { ZardDialogImports } from '@vm-web/ui/zard/components/dialog/dialog.imports';
import { ZardInputComponent } from '@vm-web/ui/zard/components/input';
import { ZardNativeSelectDirective } from '@vm-web/ui/zard/components/native-select';

import { ViewportService } from '../../../core/layout/viewport';
import { LibraryOptions } from '../library-options';
import {
  draftFromFilters,
  emptyInput,
  fieldColumn,
  filtersFromDraft,
  type FilterDraft,
  type FilterInput,
  type ScoreQueryState,
} from './score-query';
import { TreeLabelPipe } from '../../../shared/ui/tree-label.pipe';

export interface ScoreFilterResult {
  tagId: string | null;
  ensembleId: string | null;
  filters: ScoreQueryState['filters'];
}

/**
 * Filter of the score table (N-3, Design Guideline Suchen & Filtern): dialog with 480 px,
 * groups with labels, „Zurücksetzen“ and „Anzeigen“. Works on a draft; applies on „Anzeigen“.
 */
@Component({
  selector: 'vm-score-filter-dialog',
  imports: [TreeLabelPipe, NgTemplateOutlet, TranslocoPipe, VmButton, ZardDialogImports, ZardInputComponent, ZardNativeSelectDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog renders in an overlay; its host must not take up space (or a gap) in the page.
  host: { style: 'display: contents' },
  templateUrl: './score-filter-dialog.html',
})
export class ScoreFilterDialog {
  protected readonly options = inject(LibraryOptions);
  protected readonly viewport = inject(ViewportService);

  readonly open = model(false);
  readonly state = input.required<ScoreQueryState>();
  readonly applied = output<ScoreFilterResult>();

  protected readonly tagId = signal<string>('');
  protected readonly ensembleId = signal<string>('');
  protected readonly draft = signal<FilterDraft>({});

  constructor() {
    // Each time the dialog opens it starts from the active filters.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        const state = this.state();
        this.tagId.set(state.tagId ?? '');
        this.ensembleId.set(state.ensembleId ?? '');
        this.draft.set(draftFromFilters(state.filters, this.options.fields()));
      });
    });
  }

  protected column(field: FieldDefinition): string {
    return fieldColumn(field);
  }

  protected input(column: string): FilterInput | undefined {
    return this.draft()[column];
  }

  protected setText(column: string, contains: string): void {
    this.patch(column, { kind: 'text', contains });
  }

  protected setRange(column: string, part: 'from' | 'to', value: string): void {
    const current = this.draft()[column];
    const range = current?.kind === 'range' ? current : { kind: 'range' as const, from: '', to: '' };
    this.patch(column, { ...range, [part]: value });
  }

  protected toggleOption(column: string, id: string, checked: boolean): void {
    const current = this.draft()[column];
    const ids = current?.kind === 'options' ? current.ids : [];
    this.patch(column, { kind: 'options', ids: checked ? [...ids, id] : ids.filter((x) => x !== id) });
  }

  protected setBoolean(column: string, value: '' | 'true' | 'false'): void {
    this.patch(column, { kind: 'boolean', value });
  }

  protected hasOption(column: string, id: string): boolean {
    const current = this.draft()[column];
    return current?.kind === 'options' && current.ids.includes(id);
  }

  protected reset(): void {
    this.tagId.set('');
    const draft: FilterDraft = {};
    for (const key of Object.keys(this.draft())) {
      const field = this.options.fields().find((f) => fieldColumn(f) === key);
      draft[key] = emptyInput(field?.type ?? 'text');
    }
    this.draft.set(draft);
  }

  protected apply(): void {
    this.applied.emit({
      tagId: this.tagId() || null,
      ensembleId: this.ensembleId() || null,
      filters: filtersFromDraft(this.draft(), this.options.fields()),
    });
    this.open.set(false);
  }

  private patch(column: string, value: FilterInput): void {
    this.draft.update((draft) => ({ ...draft, [column]: value }));
  }
}
