import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowUp, lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import { apiUrl, voiceListResponseSchema, type VoiceListResponse } from '@vm-web/shared';

import { ZardButtonComponent } from '@/shared/components/button';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { SessionStore } from '../../../core/auth/session.store';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { ViewportService } from '../../../core/layout/viewport';
import { NameDialog } from '../../../shared/ui/name-dialog';
import { PageProblem } from '../../../shared/ui/page-problem';
import { SearchField } from '../../../shared/ui/search-field';
import { VoiceDialog, type VoiceDialogTarget } from './voice-dialog';
import { moveItem } from '../../../core/util/move-item';
import { filterGroups } from '../../../core/voices/voice-groups';
import { selectOr } from '../../../core/util/resource-value';

type Group = VoiceListResponse['groups'][number];
type Voice = Group['voices'][number];

/** Groups with voices whose name, instrument or substitutes contain the search text. */
export function filterVoiceList(groups: readonly Group[], search: string): Group[] {
  return filterGroups<Voice, Group>(groups, search, (v, hit) => hit(v.name) || v.substitutes.some((s) => hit(s.name)));
}

/** Stimmen & Instrumente (N-6, N-7, N-9, F-16): one list grouped by instrument with substitutes. */
@Component({
  selector: 'vm-library-voices-page',
  imports: [NgIcon, TranslocoPipe, PluralPipe, ZardButtonComponent, NameDialog, PageProblem, SearchField, VoiceDialog],
  viewProviders: [provideIcons({ lucidePlus, lucidePencil, lucideTrash2, lucideArrowUp, lucideArrowDown })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './voices-page.html',
})
export class VoicesPage {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);
  protected readonly viewport = inject(ViewportService);

  protected readonly canCreate = computed(() => this.session.can('voice.create'));
  protected readonly canEdit = computed(() => this.session.can('voice.edit'));
  protected readonly canDelete = computed(() => this.session.can('voice.delete'));

  protected readonly list = rxResource({ stream: () => this.api.get(apiUrl('voices', 'voiceList'), voiceListResponseSchema) });
  protected readonly groups = computed(() => selectOr(this.list, (v) => v.groups, []));
  protected readonly search = signal('');
  protected readonly shown = computed(() => filterVoiceList(this.groups(), this.search()));
  protected readonly voiceCount = computed(() => this.groups().reduce((sum, g) => sum + g.voices.length, 0));
  /** Reordering only makes sense on the full list, not on search results. */
  protected readonly canReorder = computed(() => this.canEdit() && !this.search().trim());

  protected readonly dialogOpen = signal(false);
  protected readonly dialogTarget = signal<VoiceDialogTarget | null>(null);
  protected readonly renaming = signal<Group | null>(null);
  protected readonly renameOpen = signal(false);

  protected create(): void {
    this.dialogTarget.set(null);
    this.dialogOpen.set(true);
  }

  protected edit(group: Group, voice: Voice): void {
    this.dialogTarget.set({ voice, instrumentName: group.instrument.name });
    this.dialogOpen.set(true);
  }

  protected async remove(voice: Voice): Promise<void> {
    const done = await this.confirm.confirmedDelete('library.voices.deleteTitle', 'library.voices.deleteText', { name: voice.name }, () => this.api.postVoid(apiUrl('voices', 'deleteVoice', { voiceId: voice.id })), {
      success: { key: 'library.voices.deleted', params: { name: voice.name } },
    });
    if (done) this.list.reload();
  }

  protected startRename(group: Group): void {
    this.renaming.set(group);
    this.renameOpen.set(true);
  }

  protected readonly renameInstrument = async (name: string): Promise<boolean> => {
    const group = this.renaming();
    if (!group) return false;
    const done = await this.actions.runOnce(() =>
      this.api.postVoid(apiUrl('voices', 'renameInstrument', { instrumentId: group.instrument.id }), { name }),
    );
    if (done) this.list.reload();
    return !!done;
  };

  protected async moveInstrument(index: number, delta: -1 | 1): Promise<void> {
    const ids = moveItem(this.groups().map((g) => g.instrument.id), index, delta);
    const done = await this.actions.runOnce(() => this.api.postVoid(apiUrl('voices', 'reorderInstruments'), { instrumentIds: ids }));
    if (done) this.list.reload();
  }

  protected async moveVoice(group: Group, index: number, delta: -1 | 1): Promise<void> {
    const ids = moveItem(group.voices.map((v) => v.id), index, delta);
    const done = await this.actions.runOnce(() =>
      this.api.postVoid(apiUrl('voices', 'reorderVoices', { instrumentId: group.instrument.id }), { voiceIds: ids }),
    );
    if (done) this.list.reload();
  }

  protected groupIndex(group: Group): number {
    return this.groups().findIndex((g) => g.instrument.id === group.instrument.id);
  }
}
