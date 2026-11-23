import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideChevronsUpDown,
  lucideColumns3,
  lucideDownload,
  lucideEllipsis,
  lucideFileSpreadsheet,
  lucidePlus,
  lucidePrinter,
  lucideSlidersHorizontal,
  lucideX,
} from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  appPath,
  scoreTableResponseSchema,
  type FieldDefinition,
  type ScoreColumn,
  type ScoreTableRow,
} from '@vm-web/shared';
import { map, tap } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardDropdownImports } from '@/shared/components/dropdown/dropdown.imports';

import { ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { cursorList } from '../../../core/api/cursor-list';
import { withQuery } from '../../../core/api/urls';
import { SessionStore } from '../../../core/auth/session.store';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { ViewportService } from '../../../core/layout/viewport';
import { debounced } from '../../../core/util/debounced';
import { SearchField } from '../../../shared/ui/search-field';
import { ListState } from '../../../shared/ui/list-state';
import { LibraryOptions } from '../library-options';
import { CompletenessBadge } from '../ui/completeness-badge';
import { FieldValue } from '../ui/field-value';
import { ScoreFilterDialog, type ScoreFilterResult } from './score-filter-dialog';
import {
  activeFilterCount,
  describeFilter,
  fieldColumn,
  formatDuration,
  parseScoreQuery,
  scoreQueryParams,
  scoreTableQuery,
  type ScoreQueryState,
} from './score-query';
import { PrintLauncher } from '../../../core/actions/pending-features';
import { SelectionBar } from '../../../shared/ui/selection-bar';
import { ignoreStorageErrors, readStoredStrings } from '../../../core/util/stored';
import { toggleSetItem } from '../../../core/util/sets';

const HIDDEN_COLUMNS_KEY = 'vmweb.scoreTable.hiddenColumns';

interface Column {
  id: ScoreColumn;
  labelKey?: string;
  label?: string;
  field?: FieldDefinition;
  sortable: boolean;
}

/** Stücke (N-1, N-3, N-4): table with fixed and custom fields, search, filter, sort, completeness, export. */
@Component({
  selector: 'vm-library-scores-page',
  imports: [
    RouterLink,
    NgIcon,
    TranslocoPipe,
    PluralPipe,
    ZardButtonComponent,
    ZardDropdownImports,
    SearchField,
    ListState,
    CompletenessBadge,
    FieldValue,
    ScoreFilterDialog,
    SelectionBar,
  ],
  viewProviders: [
    provideIcons({
      lucidePlus,
      lucideDownload,
      lucideFileSpreadsheet,
      lucideSlidersHorizontal,
      lucideColumns3,
      lucideX,
      lucideEllipsis,
      lucideArrowUp,
      lucideArrowDown,
      lucideChevronsUpDown,
      lucidePrinter,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scores-page.html',
})
export class ScoresPage {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionStore);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);
  protected readonly options = inject(LibraryOptions);
  protected readonly viewport = inject(ViewportService);

  protected readonly newScorePath = APP_ROUTES.library.newScore;
  protected readonly canCreate = computed(() => this.session.can('score.create'));
  protected readonly importPath = APP_ROUTES.library.importScores;
  protected readonly canImport = computed(() => this.session.can('score.create') && this.session.can('score.edit'));
  protected readonly canDelete = computed(() => this.session.can('score.delete'));
  protected readonly filterOpen = signal(false);

  /** URL query → table state. */
  protected readonly state = toSignal(this.route.queryParams.pipe(map(parseScoreQuery)), {
    initialValue: parseScoreQuery(this.route.snapshot.queryParams),
  });
  protected readonly search = signal(this.state().q);
  private readonly searchDebounced = debounced(this.search);

  protected readonly hidden = signal<ReadonlySet<string>>(readHidden());
  protected readonly allColumns = computed<Column[]>(() => [
    { id: 'title', labelKey: 'library.fields.title', sortable: true },
    { id: 'composer', labelKey: 'library.fields.composer', sortable: true },
    { id: 'arranger', labelKey: 'library.fields.arranger', sortable: true },
    { id: 'publisher', labelKey: 'library.fields.publisher', sortable: true },
    { id: 'publisherNumber', labelKey: 'library.fields.publisherNumber', sortable: true },
    { id: 'durationSeconds', labelKey: 'library.fields.duration', sortable: true },
    ...this.options.fields().map((field) => ({ id: fieldColumn(field), label: field.name, field, sortable: true })),
    { id: 'completeness', labelKey: 'library.fields.completeness', sortable: true },
  ]);
  /** The title column is always shown. */
  protected readonly columns = computed(() => this.allColumns().filter((c) => c.id === 'title' || !this.hidden().has(c.id)));

  protected readonly list = cursorList({
    params: () => this.state(),
    fetch: (state, cursor) =>
      this.api
        .get(apiUrl('scores', 'scoreTable'), scoreTableResponseSchema, { ...scoreTableQuery(state), cursor })
        .pipe(tap((page) => this.meta.set({ total: page.totalCount, ensemble: page.completenessEnsemble?.name ?? null }))),
  });
  /** Total count and completeness ensemble, from the last loaded page. */
  protected readonly meta = signal<{ total: number; ensemble: string | null } | null>(null);

  protected readonly filterCount = computed(() => activeFilterCount(this.state()));
  protected readonly chips = computed(() => {
    const state = this.state();
    const labels = {
      composer: this.transloco.translate('library.fields.composer'),
      publisher: this.transloco.translate('library.fields.publisher'),
      yes: this.transloco.translate('library.filter.yes'),
      no: this.transloco.translate('library.filter.no'),
    };
    const chips = state.filters.map((filter, index) => ({ key: `f${index}`, text: describeFilter(filter, this.options.fields(), labels), index }));
    const tag = state.tagId ? this.options.tags().find((t) => t.id === state.tagId) : null;
    return tag ? [{ key: 'tag', text: tag.name, index: -1 }, ...chips] : chips;
  });
  protected readonly exportUrl = computed(() => withQuery(apiUrl('scores', 'scoreTableExport'), scoreTableQuery(this.state())));

  constructor() {
    // Search typed in the field → URL (replaces the history entry, no entry per keystroke).
    effect(() => {
      const q = this.searchDebounced();
      if (q !== untracked(this.state).q) this.navigate({ ...untracked(this.state), q }, true);
    });
  }

  private readonly printer = inject(PrintLauncher);

  /** Selected scores for „Drucken“ (M-7); kept while filtering, cleared on demand. */
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly emptySelection: ReadonlySet<string> = new Set();
  protected readonly allSelected = computed(() => {
    const items = this.list.items();
    return items.length > 0 && items.every((row) => this.selected().has(row.id));
  });

  protected toggle(id: string): void {
    this.selected.update((current) => toggleSetItem(current, id));
  }

  protected toggleAll(): void {
    this.selected.set(this.allSelected() ? new Set() : new Set(this.list.items().map((row) => row.id)));
  }

  /** Prints the selection in table order (F-9: any score with score.view). */
  protected printSelection(): void {
    const order = this.list.items().map((row) => row.id);
    const chosen = this.selected();
    const known = order.filter((id) => chosen.has(id));
    const scoreIds = [...known, ...[...chosen].filter((id) => !known.includes(id))];
    this.printer.open({ scope: 'selection', id: '', title: this.transloco.translate('common.selection.title'), scoreIds });
  }

  protected link(row: ScoreTableRow): string {
    return appPath(APP_ROUTES.library.score, { scoreId: row.id });
  }

  protected sortBy(column: Column): void {
    if (!column.sortable) return;
    const state = this.state();
    const dir = state.sort === column.id && state.dir === 'asc' ? 'desc' : 'asc';
    this.navigate({ ...state, sort: column.id, dir });
  }

  protected ariaSort(column: Column): 'ascending' | 'descending' | null {
    const state = this.state();
    if (state.sort !== column.id) return null;
    return state.dir === 'asc' ? 'ascending' : 'descending';
  }

  protected applyFilter(result: ScoreFilterResult): void {
    this.navigate({ ...this.state(), ...result });
  }

  protected removeChip(index: number): void {
    const state = this.state();
    if (index < 0) this.navigate({ ...state, tagId: null });
    else this.navigate({ ...state, filters: state.filters.filter((_, i) => i !== index) });
  }

  protected resetFilters(): void {
    this.navigate({ ...this.state(), tagId: null, filters: [] });
  }

  protected toggleColumn(id: string, visible: boolean): void {
    this.hidden.update((current) => {
      const next = new Set(current);
      if (visible) next.delete(id);
      else next.add(id);
      writeHidden(next);
      return next;
    });
  }

  protected isVisible(id: string): boolean {
    return !this.hidden().has(id);
  }

  protected duration(row: ScoreTableRow): string {
    return formatDuration(row.durationSeconds);
  }

  protected async remove(row: ScoreTableRow): Promise<void> {
    const done = await this.confirm.confirmedDelete('library.scores.deleteTitle', 'library.scores.deleteText', { title: row.title }, () => this.api.postVoid(apiUrl('scores', 'deleteScore', { scoreId: row.id })), {
      success: { key: 'library.scores.deleted', params: { title: row.title } },
    });
    if (done) this.list.reload();
  }

  private navigate(state: ScoreQueryState, replaceUrl = false): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: scoreQueryParams(state), replaceUrl });
  }

}

function readHidden(): Set<string> {
  return new Set(readStoredStrings(() => localStorage, HIDDEN_COLUMNS_KEY));
}

/** With blocked storage the choice lasts until reload. */
function writeHidden(hidden: ReadonlySet<string>): void {
  ignoreStorageErrors(() => localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify([...hidden])));
}
