import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideFileSpreadsheet, lucideTriangleAlert, lucideUpload } from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  ensembleOptionsResponseSchema,
  scoreImportResponseSchema,
  type ScoreImportAction,
  type ScoreImportResponse,
  type ScoreImportResultRow,
} from '@vm-web/shared';
import { catchError, firstValueFrom, of } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';

import { ActionRunner } from '../../../../core/actions/action-runner';
import { ApiClient } from '../../../../core/api/api-client';
import { SessionStore } from '../../../../core/auth/session.store';
import { PluralPipe } from '../../../../core/i18n/plural.pipe';
import { TreeLabelPipe } from '../../../../shared/ui/tree-label.pipe';
import { LibraryOptions } from '../../library-options';
import { readCsvFile, type CsvTable } from './csv';
import {
  buildImportBody,
  examples,
  FIXED_TARGETS,
  initialMapping,
  mappingProblems,
  NEW_FIELD_TYPES,
  storeMapping,
  usesFolder,
  type ColumnMapping,
  type ColumnTarget,
} from './import-model';
import { selectOr } from '../../../../core/util/resource-value';

type RowFilter = 'all' | 'issues' | 'matches';

/**
 * Stücke importieren (N-19): read a CSV in the browser, map each column to a score field, a new
 * custom field or the folder, preview the result with matches (`dryRun`), then import.
 */
@Component({
  selector: 'vm-score-import-page',
  imports: [RouterLink, NgIcon, TranslocoPipe, PluralPipe, TreeLabelPipe, ZardButtonComponent, ZardInputComponent, ZardNativeSelectDirective],
  viewProviders: [provideIcons({ lucideUpload, lucideFileSpreadsheet, lucideCircleAlert, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './score-import-page.html',
})
export class ScoreImportPage {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly session = inject(SessionStore);
  protected readonly options = inject(LibraryOptions);

  protected readonly scoresPath = APP_ROUTES.library.scores;
  protected readonly fixedTargets = FIXED_TARGETS;
  protected readonly newFieldTypes = NEW_FIELD_TYPES;
  protected readonly canEdit = computed(() => this.session.can('score.edit'));

  protected readonly fileName = signal<string | null>(null);
  protected readonly table = signal<CsvTable | null>(null);
  protected readonly readError = signal(false);
  protected readonly columns = signal<ColumnMapping[]>([]);
  protected readonly fixedFolder = signal('');
  protected readonly folderEnsembleId = signal('');

  protected readonly preview = signal<ScoreImportResponse | null>(null);
  protected readonly result = signal<ScoreImportResponse | null>(null);
  protected readonly rowActions = signal(new Map<number, ScoreImportAction>());
  protected readonly rowFilter = signal<RowFilter>('all');
  protected readonly busy = signal<'preview' | 'import' | null>(null);

  /** Ensembles where folders may be created; empty (and no folder targets) without `folder.create`. */
  protected readonly ensembles = rxResource({
    stream: () => this.api.get(apiUrl('folders', 'ensembleOptions'), ensembleOptionsResponseSchema).pipe(catchError(() => of({ items: [] }))),
  });
  protected readonly ensembleItems = computed(() => selectOr(this.ensembles, (v) => v.items, []));
  protected readonly canUseFolders = computed(() => this.ensembleItems().length > 0);

  protected readonly problems = computed(() => mappingProblems(this.columns(), this.options.fields()));
  /** Required custom fields without a column: new scores would fail (existing ones are only linked). */
  protected readonly requiredUnmapped = computed(() =>
    this.options
      .fields()
      .filter((f) => f.required && !this.columns().some((c) => c.target === `field:${f.id}`))
      .map((f) => f.name),
  );
  protected readonly withFolder = computed(() => usesFolder(this.columns(), { fixedFolder: this.fixedFolder() }));
  protected readonly hasFolderColumn = computed(() => this.columns().some((c) => c.target === 'folder'));
  protected readonly hasNumberColumn = computed(() => this.columns().some((c) => c.target === 'folderNumber'));
  protected readonly ready = computed(
    () => !!this.table() && this.problems().length === 0 && (!this.withFolder() || !!this.folderEnsembleId()),
  );

  protected readonly shownRows = computed(() => {
    const rows = this.preview()?.rows ?? [];
    switch (this.rowFilter()) {
      case 'issues':
        return rows.filter((r) => r.issues.length > 0);
      case 'matches':
        return rows.filter((r) => r.match !== null);
      default:
        return rows;
    }
  });
  protected readonly importCount = computed(() => {
    const s = this.preview()?.summary;
    return s ? s.create + s.link + s.overwrite : 0;
  });

  protected async onPick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.reset();
    this.fileName.set(file.name);
    try {
      const table = await readCsvFile(file);
      if (!table.headers.length || !table.rows.length) throw new Error('empty');
      this.table.set(table);
      this.columns.set(initialMapping(table.headers, this.options.fields()));
      if (this.ensembleItems().length === 1) this.folderEnsembleId.set(this.ensembleItems()[0].id);
    } catch {
      this.readError.set(true);
    }
  }

  protected examplesOf(column: number): string[] {
    const table = this.table();
    return table ? examples(table, column) : [];
  }

  protected setTarget(index: number, target: string): void {
    this.patchColumn(index, { target: target as ColumnTarget });
  }

  protected patchColumn(index: number, patch: Partial<ColumnMapping>): void {
    this.columns.update((columns) => columns.map((c, i) => (i === index ? { ...c, ...patch } : c)));
    this.preview.set(null);
    this.rowActions.set(new Map());
  }

  protected setFixedFolder(value: string): void {
    this.fixedFolder.set(value);
    this.preview.set(null);
  }

  protected setEnsemble(value: string): void {
    this.folderEnsembleId.set(value);
    this.preview.set(null);
  }

  protected async setAction(row: ScoreImportResultRow, action: string): Promise<void> {
    this.rowActions.update((map) => new Map(map).set(row.line, action as ScoreImportAction));
    await this.runPreview();
  }

  /** Actions offered per row: link/overwrite only with a match. */
  protected actionsFor(row: ScoreImportResultRow): ScoreImportAction[] {
    return row.match ? ['link', 'overwrite', 'create', 'skip'] : ['create', 'skip'];
  }

  /** Label of an issue target: fixed field, custom field name, new field name or folder. */
  protected targetLabel(target: string): string {
    if (target.startsWith('field:')) return this.options.fields().find((f) => f.id === target.slice(6))?.name ?? '';
    if (target.startsWith('new:col-')) return this.columns()[Number(target.slice(8))]?.newName ?? '';
    return '';
  }

  protected async runPreview(): Promise<void> {
    const table = this.table();
    if (!table || !this.ready()) return;
    this.busy.set('preview');
    const body = buildImportBody(table, this.settings(), this.rowActions(), true);
    const done = await this.actions.run(() => firstValueFrom(this.api.post(apiUrl('scores', 'importScores'), body, scoreImportResponseSchema)));
    this.busy.set(null);
    if (done) {
      this.preview.set(done.value);
      storeMapping(table.headers, this.columns());
    }
  }

  protected async runImport(): Promise<void> {
    const table = this.table();
    if (!table || !this.preview()) return;
    this.busy.set('import');
    const body = buildImportBody(table, this.settings(), this.rowActions(), false);
    const done = await this.actions.run(() => firstValueFrom(this.api.post(apiUrl('scores', 'importScores'), body, scoreImportResponseSchema)), {
      success: { key: 'library.import.done' },
    });
    this.busy.set(null);
    if (done) {
      this.result.set(done.value);
      this.preview.set(null);
      this.table.set(null);
      this.options.reloadFields();
    }
  }

  protected reset(): void {
    this.table.set(null);
    this.fileName.set(null);
    this.readError.set(false);
    this.columns.set([]);
    this.preview.set(null);
    this.result.set(null);
    this.rowActions.set(new Map());
    this.rowFilter.set('all');
  }

  private settings() {
    return { columns: this.columns(), fixedFolder: this.fixedFolder(), folderEnsembleId: this.folderEnsembleId() };
  }
}
