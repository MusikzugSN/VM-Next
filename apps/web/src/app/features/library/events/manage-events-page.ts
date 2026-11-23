import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePencil, lucidePlus, lucideTrash2 } from '@ng-icons/lucide';
import {
  APP_ROUTES,
  apiUrl,
  appPath,
  createdResponseSchema,
  ensembleOptionsResponseSchema,
  eventListResponseSchema,
  type EventListItem,
} from '@vm-web/shared';

import { VmButton, VmIconButton } from '@vm-web/ui';
import { ZardNativeSelectDirective } from '@vm-web/ui/zard/components/native-select';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { cursorList } from '../../../core/api/cursor-list';
import { SessionStore } from '../../../core/auth/session.store';
import { PluralPipe } from '../../../core/i18n/plural.pipe';
import { ViewportService } from '../../../core/layout/viewport';
import { debounced } from '../../../core/util/debounced';
import { ListState } from '../../../shared/ui/list-state';
import { SearchField } from '../../../shared/ui/search-field';
import { ToggleSwitch } from '../../../shared/ui/toggle-switch';
import { CreateInEnsembleDialog, type CreateInEnsemble } from '../ui/create-in-ensemble-dialog';
import { ensemblesWith } from '../ui/ensembles-with';

/** Events verwalten (N-15): upcoming and past events per ensemble, visibility, create and delete. */
@Component({
  selector: 'vm-library-manage-events-page',
  imports: [
    DatePipe,
    RouterLink,
    NgIcon,
    TranslocoPipe,
    PluralPipe,
    VmButton, VmIconButton,
    ZardNativeSelectDirective,
    ListState,
    SearchField,
    ToggleSwitch,
    CreateInEnsembleDialog,
  ],
  viewProviders: [provideIcons({ lucidePlus, lucidePencil, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './manage-events-page.html',
})
export class ManageEventsPage {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  protected readonly viewport = inject(ViewportService);

  /** Query parameter `?tab=archive`. */
  readonly tab = input<string>();

  protected readonly eventsPath = APP_ROUTES.library.events;
  protected readonly period = computed<'upcoming' | 'past'>(() => (this.tab() === 'archive' ? 'past' : 'upcoming'));
  protected readonly ensembleId = signal('');
  protected readonly search = signal('');
  private readonly query = debounced(this.search);
  protected readonly creating = signal(false);

  protected readonly createOptions = rxResource({
    stream: () => this.api.get(apiUrl('events', 'ensembleOptions'), ensembleOptionsResponseSchema),
  });
  protected readonly canCreate = computed(() => this.createOptions.hasValue() && this.createOptions.value().items.length > 0);
  protected readonly filterOptions = computed(() => ensemblesWith(this.session, 'event.view'));

  protected readonly list = cursorList({
    params: () => ({ period: this.period(), ensembleId: this.ensembleId() || undefined, q: this.query().trim() || undefined }),
    fetch: (p, cursor) => this.api.get(apiUrl('events', 'eventList'), eventListResponseSchema, { ...p, cursor }),
  });

  protected link(event: EventListItem): string {
    return appPath(APP_ROUTES.library.event, { eventId: event.id });
  }

  protected canEdit(event: EventListItem): boolean {
    return this.session.can('event.edit', event.ensemble.id);
  }

  protected canDelete(event: EventListItem): boolean {
    return this.session.can('event.delete', event.ensemble.id);
  }

  protected visibilityLabel(event: EventListItem): string {
    return this.transloco.translate('library.folders.showLabel', { name: event.name });
  }

  protected readonly create = async (input: CreateInEnsemble): Promise<boolean> => {
    const done = await this.actions.runOnce(
      () =>
        this.api.post(
            apiUrl('events', 'createEvent'),
            { ensembleId: input.ensembleId, name: input.name, date: input.date, showInMyArea: input.show },
            createdResponseSchema,
          ),
      { success: { key: 'library.events.created', params: { name: input.name } } },
    );
    if (done) void this.router.navigateByUrl(appPath(APP_ROUTES.library.event, { eventId: done.value.id }));
    return !!done;
  };

  protected async setVisibility(event: EventListItem, show: boolean): Promise<void> {
    const done = await this.actions.runOnce(
      () => this.api.postVoid(apiUrl('events', 'setVisibility', { eventId: event.id }), { showInMyArea: show }),
      { success: { key: show ? 'library.folders.shown' : 'library.folders.hidden', params: { name: event.name } } },
    );
    if (done) this.list.reload();
  }

  protected async remove(event: EventListItem): Promise<void> {
    const done = await this.confirm.confirmedDelete('library.events.deleteTitle', 'library.events.deleteText', { name: event.name }, () => this.api.postVoid(apiUrl('events', 'deleteEvent', { eventId: event.id })), {
      success: { key: 'library.events.deleted', params: { name: event.name } },
    });
    if (done) this.list.reload();
  }
}
