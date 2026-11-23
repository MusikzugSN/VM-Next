import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideWandSparkles } from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  appPath,
  applyLineupTemplateResponseSchema,
  ensembleDetailsResponseSchema,
  ensembleLineupResponseSchema,
  ensembleMembersResponseSchema,
  userAssignmentOptionsResponseSchema,
} from '@vm-web/shared';
import { firstValueFrom, of } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { cursorList } from '../../../core/api/cursor-list';
import { SessionStore } from '../../../core/auth/session.store';
import { initials } from '../../../core/branding/branding.store';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { debounced } from '../../../core/util/debounced';
import { VoiceContextStore } from '../../../core/voices/voice-context.store';
import { ListState } from '../../../shared/ui/list-state';
import { NameDialog } from '../../../shared/ui/name-dialog';
import { PageProblem } from '../../../shared/ui/page-problem';
import { SearchField } from '../../../shared/ui/search-field';
import { TreeLabelPipe } from '../../../shared/ui/tree-label.pipe';
import { usePageName } from '../../../core/layout/page';
import { PrintRulesTab } from './print-rules-tab';

type EnsembleTab = 'details' | 'lineup' | 'members' | 'print';
const TABS: readonly EnsembleTab[] = ['details', 'lineup', 'members', 'print'];

/** Ensemble (S-2, F-3, N-8): Stammdaten · Besetzung · Mitglieder (tab in `?tab=`). */
@Component({
  selector: 'vm-system-ensemble-page',
  imports: [TreeLabelPipe, DatePipe, RouterLink, NgIcon, TranslocoPipe, PluralPipe, ZardButtonComponent, ZardNativeSelectDirective, ListState, NameDialog, PageProblem, SearchField, PrintRulesTab],
  viewProviders: [provideIcons({ lucideChevronLeft, lucideWandSparkles })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ensemble-page.html',
})
export class EnsemblePage {
  /** Breadcrumb and document title show the loaded element's name. */
  private readonly pageName = usePageName(() => this.ensemble()?.name);
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);
  protected readonly voices = inject(VoiceContextStore);

  /** Route parameter. */
  readonly ensembleId = input.required<string>();
  /** Query parameter. */
  readonly tab = input<string>();

  protected readonly listPath = APP_ROUTES.system.ensembles;
  protected readonly canEdit = computed(() => this.session.can('ensemble.edit'));
  protected readonly canSeeUsers = computed(() => this.session.can('user.view'));
  protected readonly current = computed<EnsembleTab>(() => (TABS.includes(this.tab() as EnsembleTab) ? (this.tab() as EnsembleTab) : 'details'));
  protected readonly tabs: { id: EnsembleTab; labelKey: string }[] = [
    { id: 'details', labelKey: 'system.ensemble.tabDetails' },
    { id: 'lineup', labelKey: 'system.ensemble.tabLineup' },
    { id: 'members', labelKey: 'system.ensemble.tabMembers' },
    { id: 'print', labelKey: 'system.ensemble.tabPrint' },
  ];

  protected readonly details = rxResource({
    params: () => this.ensembleId(),
    stream: ({ params }) => this.api.get(apiUrl('system', 'ensembleDetails', { ensembleId: params }), ensembleDetailsResponseSchema),
  });
  protected readonly ensemble = computed(() => (this.details.hasValue() ? this.details.value() : null));
  protected readonly selfPath = computed(() => appPath(APP_ROUTES.system.ensemble, { ensembleId: this.ensembleId() }));

  // Stammdaten
  protected readonly renaming = signal(false);
  private readonly options = rxResource({
    stream: () => this.api.get(apiUrl('system', 'userAssignmentOptions'), userAssignmentOptionsResponseSchema),
  });
  /** Possible parents: every active ensemble except this one (the API rejects descendants with `invalid-hierarchy`). */
  protected readonly parents = computed(() => (this.options.hasValue() ? this.options.value().ensembles.filter((e) => e.id !== this.ensembleId()) : []));
  protected readonly parentName = computed(() => {
    const parentId = this.ensemble()?.parentId;
    return (this.options.hasValue() ? this.options.value().ensembles.find((e) => e.id === parentId)?.name : undefined) ?? '–';
  });

  // Besetzung
  protected readonly lineup = rxResource({
    params: () => (this.current() === 'lineup' ? this.ensembleId() : undefined),
    stream: ({ params }) => this.api.get(apiUrl('system', 'ensembleLineup', { ensembleId: params }), ensembleLineupResponseSchema),
  });
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly lineupDirty = computed(() => {
    const saved = new Set(this.lineup.hasValue() ? this.lineup.value().voices.map((v) => v.id) : []);
    const chosen = this.selected();
    return saved.size !== chosen.size || [...chosen].some((id) => !saved.has(id));
  });

  // Mitglieder
  protected readonly memberSearch = signal('');
  private readonly memberQuery = debounced(this.memberSearch);
  protected readonly members = cursorList({
    params: () => (this.current() === 'members' ? { id: this.ensembleId(), q: this.memberQuery().trim() || undefined } : null),
    fetch: (p, cursor) =>
      p ? this.api.get(apiUrl('system', 'ensembleMembers', { ensembleId: p.id }), ensembleMembersResponseSchema, { q: p.q, cursor }) : of({ items: [], nextCursor: null }),
  });

  constructor() {
    effect(() => {
      if (!this.lineup.hasValue()) return;
      const ids = this.lineup.value().voices.map((v) => v.id);
      untracked(() => this.selected.set(new Set(ids)));
    });
  }

  protected userLink(userId: string): string {
    return appPath(APP_ROUTES.system.user, { userId });
  }

  protected readonly initialsOf = initials;

  protected readonly rename = async (name: string): Promise<boolean> => {
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('system', 'renameEnsemble', { ensembleId: this.ensembleId() }), { name })), {
      success: { key: 'system.ensemble.renamed', params: { name } },
    });
    if (done) this.changed();
    return !!done;
  };

  protected async setParent(parentId: string): Promise<void> {
    if (!parentId || parentId === this.ensemble()?.parentId) return;
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('system', 'moveEnsemble', { ensembleId: this.ensembleId() }), { parentId })), {
      success: { key: 'system.ensemble.moved' },
    });
    // Reload either way: on `invalid-hierarchy` the select must show the old parent again.
    this.details.reload();
    if (done) void this.session.reload();
  }

  protected toggleVoice(id: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** All voices of one instrument on or off. */
  protected toggleInstrument(voices: readonly { id: string }[]): void {
    const voiceIds = voices.map((v) => v.id);
    const allOn = this.allOn(voices);
    this.selected.update((current) => {
      const next = new Set(current);
      for (const id of voiceIds) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  protected allOn(voiceIds: readonly { id: string }[]): boolean {
    return voiceIds.length > 0 && voiceIds.every((v) => this.selected().has(v.id));
  }

  protected async saveLineup(): Promise<void> {
    // Order of the lineup = order of instruments and voices (N-4).
    const voiceIds = this.voices
      .options()
      .flatMap((g) => g.voices)
      .map((v) => v.id)
      .filter((id) => this.selected().has(id));
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('system', 'setLineup', { ensembleId: this.ensembleId() }), { voiceIds })), {
      success: { key: 'system.ensemble.lineupSaved' },
    });
    if (done) this.lineupChanged();
  }

  protected async applyTemplate(): Promise<void> {
    const name = this.ensemble()?.name ?? '';
    if (!(await this.confirm.confirm('system.ensemble.templateTitle', 'system.ensemble.templateText', { name }, 'system.ensemble.templateOk'))) return;
    const done = await this.actions.run(() =>
      firstValueFrom(this.api.post(apiUrl('system', 'applyLineupTemplate', { ensembleId: this.ensembleId() }), {}, applyLineupTemplateResponseSchema)),
    );
    if (!done) return;
    this.actions.notify('system.ensemble.templateDone', { ...done.value });
    this.voices.reloadOptions();
    this.lineupChanged();
  }

  private lineupChanged(): void {
    this.lineup.reload();
    this.details.reload();
  }

  private changed(): void {
    this.details.reload();
    this.options.reload();
    void this.session.reload();
  }
}
