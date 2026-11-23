import { CdkDrag, CdkDragHandle, CdkDropList, moveItemInArray, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowUp, lucideChevronLeft, lucideGripVertical, lucidePlus, lucidePrinter, lucideTrash2, lucideX } from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  appPath,
  eventDetailsResponseSchema,
  eventScoreCandidatesResponseSchema,
  setlistResponseSchema,
  type SetlistEntry,
} from '@vm-web/shared';
import { firstValueFrom, map, type Observable } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputComponent } from '@/shared/components/input';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { SessionStore } from '../../../core/auth/session.store';
import { PageProblem } from '../../../shared/ui/page-problem';
import { ToggleSwitch } from '../../../shared/ui/toggle-switch';
import { FormDialog } from '../../../shared/ui/form-dialog';
import { ScorePicker, type CandidatePage, type PickedScore } from '../ui/score-picker';
import { moveItem } from '../../../core/util/move-item';
import { usePageName } from '../../../core/layout/page';
import { PrintLauncher } from '../../../core/actions/pending-features';

/** API limit of `set-setlist`. */
export const MAX_SETLIST = 200;

type Item = Pick<SetlistEntry, 'scoreId' | 'title' | 'composer'>;

/** Event bearbeiten (N-15, N-16): date, name, visibility and the setlist in playing order. */
@Component({
  selector: 'vm-library-edit-event-page',
  imports: [
    FormDialog,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    RouterLink,
    NgIcon,
    TranslocoPipe,
    ZardButtonComponent,
    ZardInputComponent,
    PageProblem,
    ToggleSwitch,
    ScorePicker,
  ],
  viewProviders: [provideIcons({ lucidePrinter, lucideChevronLeft, lucideGripVertical, lucideArrowUp, lucideArrowDown, lucideX, lucidePlus, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './edit-event-page.html',
})
export class EditEventPage {
  private readonly printer = inject(PrintLauncher);
  /** Breadcrumb and document title show the loaded element's name. */
  private readonly pageName = usePageName(() => this.details.hasValue() ? this.details.value().name : null);
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  /** Route parameter. */
  readonly eventId = input.required<string>();

  protected readonly eventsPath = APP_ROUTES.library.events;
  protected readonly max = MAX_SETLIST;

  protected readonly details = rxResource({
    params: () => this.eventId(),
    stream: ({ params }) => this.api.get(apiUrl('events', 'eventDetails', { eventId: params }), eventDetailsResponseSchema),
  });
  protected readonly ensembleId = computed(() => (this.details.hasValue() ? this.details.value().ensemble.id : undefined));
  protected readonly canEdit = computed(() => this.session.can('event.edit', this.ensembleId()));
  protected readonly canDelete = computed(() => this.session.can('event.delete', this.ensembleId()));

  protected readonly name = signal('');
  protected readonly date = signal('');
  protected readonly detailsDirty = computed(() => {
    if (!this.details.hasValue()) return false;
    const d = this.details.value();
    return this.name().trim() !== d.name || this.date() !== d.date;
  });

  /** Setlist as edited; `saved` is the order on the server. */
  protected readonly items = signal<Item[]>([]);
  private readonly saved = signal<string[]>([]);
  protected readonly setlistLoaded = signal(false);
  protected readonly setlistDirty = computed(() => this.items().map((i) => i.scoreId).join() !== this.saved().join());
  protected readonly adding = signal(false);
  /** Announced after each move (aria-live). */
  protected readonly announcement = signal('');

  protected readonly candidates = computed(() => {
    const eventId = this.eventId();
    return (q: string): Observable<CandidatePage> =>
      this.api.get(apiUrl('events', 'scoreCandidates', { eventId }), eventScoreCandidatesResponseSchema, { q }).pipe(
        // Scores added here but not saved yet count as contained, too.
        map((page) => {
          const local = new Set(untracked(this.items).map((i) => i.scoreId));
          return { items: page.items.map((s) => ({ ...s, alreadyContained: s.alreadyContained || local.has(s.id) })) };
        }),
      );
  });

  constructor() {
    effect(() => {
      if (!this.details.hasValue()) return;
      const d = this.details.value();
      untracked(() => {
        this.name.set(d.name);
        this.date.set(d.date);
      });
    });
    effect(() => {
      const eventId = this.eventId();
      untracked(() => void this.loadSetlist(eventId));
    });
  }

  protected scoreLink(item: Item): string {
    return appPath(APP_ROUTES.library.score, { scoreId: item.scoreId });
  }

  protected visibilityLabel(): string {
    return this.transloco.translate('library.common.showInMyArea');
  }

  protected drop(event: CdkDragDrop<Item[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const next = [...this.items()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.items.set(next);
    this.announce(next[event.currentIndex], event.currentIndex);
  }

  protected move(index: number, delta: -1 | 1): void {
    const next = moveItem(this.items(), index, delta);
    this.items.set(next);
    this.announce(next[index + delta], index + delta);
  }

  protected removeItem(index: number): void {
    const item = this.items()[index];
    this.items.update((list) => list.filter((_, i) => i !== index));
    this.announcement.set(this.transloco.translate('library.event.removedAnnounce', { title: item.title }));
  }

  protected add(picked: PickedScore): void {
    if (this.items().some((i) => i.scoreId === picked.score.id) || this.items().length >= MAX_SETLIST) return;
    this.items.update((list) => [...list, { scoreId: picked.score.id, title: picked.score.title, composer: picked.score.composer }]);
    this.announcement.set(this.transloco.translate('library.event.addedAnnounce', { title: picked.score.title, position: this.items().length }));
  }

  protected resetSetlist(): void {
    void this.loadSetlist(this.eventId());
  }

  protected async saveSetlist(): Promise<void> {
    const scoreIds = this.items().map((i) => i.scoreId);
    const done = await this.actions.run(
      () => firstValueFrom(this.api.postVoid(apiUrl('events', 'setSetlist', { eventId: this.eventId() }), { scoreIds })),
      { success: { key: 'library.event.setlistSaved' } },
    );
    if (done) this.saved.set(scoreIds);
  }

  protected async saveDetails(): Promise<void> {
    const body = { name: this.name().trim(), date: this.date() };
    if (!body.name || !body.date) return;
    const done = await this.actions.run(
      () => firstValueFrom(this.api.postVoid(apiUrl('events', 'updateDetails', { eventId: this.eventId() }), body)),
      { success: { key: 'library.form.saved' } },
    );
    if (done) this.details.reload();
  }

  protected async setVisibility(show: boolean): Promise<void> {
    const done = await this.actions.run(() =>
      firstValueFrom(this.api.postVoid(apiUrl('events', 'setVisibility', { eventId: this.eventId() }), { showInMyArea: show })),
    );
    if (done) this.details.reload();
  }

  protected async deleteEvent(): Promise<void> {
    const name = this.details.hasValue() ? this.details.value().name : '';
    if (!(await this.confirm.confirmDelete('library.events.deleteTitle', 'library.events.deleteText', { name }))) return;
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('events', 'deleteEvent', { eventId: this.eventId() }))), {
      success: { key: 'library.events.deleted', params: { name } },
    });
    if (done) void this.router.navigateByUrl(this.eventsPath);
  }

  /** The setlist is edited as a whole (set-setlist replaces it), so all pages are loaded. */
  private async loadSetlist(eventId: string): Promise<void> {
    this.setlistLoaded.set(false);
    const all: Item[] = [];
    let cursor: string | undefined;
    try {
      do {
        const page = await firstValueFrom(
          this.api.get(apiUrl('events', 'setlist', { eventId }), setlistResponseSchema, { cursor, limit: MAX_SETLIST }),
        );
        all.push(...page.items.map(({ scoreId, title, composer }) => ({ scoreId, title, composer })));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
    } catch {
      // The details request shows the problem; the setlist stays empty.
    }
    this.items.set(all);
    this.saved.set(all.map((i) => i.scoreId));
    this.setlistLoaded.set(true);
  }

  private announce(item: Item, index: number): void {
    this.announcement.set(
      this.transloco.translate('library.event.movedAnnounce', { title: item.title, position: index + 1, count: this.items().length }),
    );
  }

  /** Druckdialog (D-1) for the whole event; the voices come from the voice switch. */
  protected print(): void {
    this.printer.open({ scope: 'event', id: this.eventId(), title: this.details.hasValue() ? this.details.value().name : '' });
  }
}
