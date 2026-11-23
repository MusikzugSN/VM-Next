import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucidePlus, lucidePrinter, lucideTrash2, lucideX } from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  appPath,
  folderDetailsResponseSchema,
  folderEntriesResponseSchema,
  folderScoreCandidatesResponseSchema,
  type FolderEntry,
} from '@vm-web/shared';
import { firstValueFrom, type Observable } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputComponent } from '@/shared/components/input';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { cursorList } from '../../../core/api/cursor-list';
import { SessionStore } from '../../../core/auth/session.store';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { debounced } from '../../../core/util/debounced';
import { ListState } from '../../../shared/ui/list-state';
import { PageProblem } from '../../../shared/ui/page-problem';
import { SearchField } from '../../../shared/ui/search-field';
import { ToggleSwitch } from '../../../shared/ui/toggle-switch';
import { FormDialog } from '../../../shared/ui/form-dialog';
import { ScorePicker, type CandidatePage, type PickedScore } from '../ui/score-picker';
import { usePageName } from '../../../core/layout/page';
import { PrintLauncher } from '../../../core/actions/pending-features';
import { selectOr } from '../../../core/util/resource-value';

/** Mappe bearbeiten (N-5, N-15): name, visibility, scores with their own number in this folder. */
@Component({
  selector: 'vm-library-edit-folder-page',
  imports: [
    FormDialog,
    RouterLink,
    NgIcon,
    TranslocoPipe,
    PluralPipe,
    ZardButtonComponent,
    ZardInputComponent,
    ListState,
    PageProblem,
    SearchField,
    ToggleSwitch,
    ScorePicker,
  ],
  viewProviders: [provideIcons({ lucidePrinter, lucideChevronLeft, lucidePlus, lucideTrash2, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './edit-folder-page.html',
})
export class EditFolderPage {
  private readonly printer = inject(PrintLauncher);
  /** Breadcrumb and document title show the loaded element's name. */
  private readonly pageName = usePageName(() => selectOr(this.details, (v) => v.name, null));
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  /** Route parameter. */
  readonly folderId = input.required<string>();

  protected readonly foldersPath = APP_ROUTES.library.folders;
  protected readonly search = signal('');
  private readonly query = debounced(this.search);
  protected readonly adding = signal(false);
  /** Last problem per score number input, shown below the field. */
  protected readonly numberErrors = signal<Record<string, string>>({});

  protected readonly details = rxResource({
    params: () => this.folderId(),
    stream: ({ params }) => this.api.get(apiUrl('folders', 'folderDetails', { folderId: params }), folderDetailsResponseSchema),
  });
  protected readonly ensembleId = computed(() => selectOr(this.details, (v) => v.ensemble.id, undefined));
  protected readonly canEdit = computed(() => this.session.can('folder.edit', this.ensembleId()));
  protected readonly canDelete = computed(() => this.session.can('folder.delete', this.ensembleId()));

  protected readonly list = cursorList({
    params: () => ({ folderId: this.folderId(), q: this.query().trim() || undefined }),
    fetch: (p, cursor) =>
      this.api.get(apiUrl('folders', 'folderEntries', { folderId: p.folderId }), folderEntriesResponseSchema, { cursor, q: p.q }),
  });

  protected readonly candidates = computed(() => {
    const folderId = this.folderId();
    return (q: string): Observable<CandidatePage> =>
      this.api.get(apiUrl('folders', 'scoreCandidates', { folderId }), folderScoreCandidatesResponseSchema, { q });
  });

  protected scoreLink(entry: FolderEntry): string {
    return appPath(APP_ROUTES.library.score, { scoreId: entry.scoreId });
  }

  protected visibilityLabel(): string {
    return this.transloco.translate('library.common.showInMyArea');
  }

  protected async rename(name: string): Promise<void> {
    const current = selectOr(this.details, (v) => v.name, '');
    if (!name.trim() || name.trim() === current) return;
    const done = await this.actions.run(
      () => firstValueFrom(this.api.postVoid(apiUrl('folders', 'renameFolder', { folderId: this.folderId() }), { name: name.trim() })),
      { success: { key: 'library.common.savedName' } },
    );
    if (done) this.details.reload();
  }

  protected async setVisibility(show: boolean): Promise<void> {
    const done = await this.actions.run(() =>
      firstValueFrom(this.api.postVoid(apiUrl('folders', 'setVisibility', { folderId: this.folderId() }), { showInMyArea: show })),
    );
    if (done) this.details.reload();
  }

  protected async setNumber(entry: FolderEntry, value: string): Promise<void> {
    const number = value.trim();
    if (number === entry.number) return;
    if (!number) {
      this.numberErrors.update((e) => ({ ...e, [entry.scoreId]: 'library.folder.numberRequired' }));
      return;
    }
    const done = await this.actions.run(
      () => firstValueFrom(this.api.postVoid(apiUrl('folders', 'setScoreNumber', { folderId: this.folderId() }), { scoreId: entry.scoreId, number })),
      {
        onProblem: (problem) => {
          this.numberErrors.update((e) => ({ ...e, [entry.scoreId]: problemKey(problem) }));
          return true;
        },
      },
    );
    if (done) {
      this.numberErrors.update((errors) => {
        const next = { ...errors };
        delete next[entry.scoreId];
        return next;
      });
      this.list.reload();
    }
  }

  protected async add(picked: PickedScore): Promise<void> {
    const done = await this.actions.run(
      () =>
        firstValueFrom(
          this.api.postVoid(apiUrl('folders', 'addScore', { folderId: this.folderId() }), { scoreId: picked.score.id, number: picked.number }),
        ),
      { success: { key: 'library.folder.added', params: { title: picked.score.title, number: picked.number } } },
    );
    if (done) {
      this.list.reload();
      this.details.reload();
    }
  }

  protected async remove(entry: FolderEntry): Promise<void> {
    const done = await this.actions.run(
      () => firstValueFrom(this.api.postVoid(apiUrl('folders', 'removeScore', { folderId: this.folderId() }), { scoreId: entry.scoreId })),
      { success: { key: 'library.folder.removed', params: { title: entry.title } } },
    );
    if (done) {
      this.list.reload();
      this.details.reload();
    }
  }

  protected async deleteFolder(): Promise<void> {
    const name = selectOr(this.details, (v) => v.name, '');
    if (!(await this.confirm.confirmDelete('library.folders.deleteTitle', 'library.folders.deleteText', { name }))) return;
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('folders', 'deleteFolder', { folderId: this.folderId() }))), {
      success: { key: 'library.folders.deleted', params: { name } },
    });
    if (done) void this.router.navigateByUrl(this.foldersPath);
  }

  /** Druckdialog (D-1) for the whole folder; the voices come from the voice switch. */
  protected print(): void {
    this.printer.open({ scope: 'folder', id: this.folderId(), title: selectOr(this.details, (v) => v.name, '') });
  }
}

/** Text key for a failed number change: duplicate numbers come as `conflict`/`name-taken`. */
export function problemKey(problem: unknown): string {
  const code = (problem as { code?: string } | null)?.code;
  if (code === 'conflict' || code === 'name-taken') return 'library.folder.numberTaken';
  if (code === 'validation-failed') return 'library.folder.numberInvalid';
  return code ? `errors.${code}` : 'errors.unknown';
}
