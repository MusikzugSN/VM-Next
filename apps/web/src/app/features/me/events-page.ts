import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import { APP_ROUTES, apiUrl, appPath, archivedEventsResponseSchema, upcomingEventsResponseSchema } from '@vm-web/shared';
import { VmCard } from '@vm-web/ui';

import { ApiClient } from '../../core/api/api-client';
import { cursorList } from '../../core/api/cursor-list';
import { EventDate } from './ui/event-date';
import { ListState } from '../../shared/ui/list-state';

export type EventsTab = 'upcoming' | 'archive';

/** Events (M-5): tabs „Kommende“ and „Archiv“ as query parameter `?tab=archive`. */
@Component({
  selector: 'vm-me-events-page',
  imports: [VmCard, PluralPipe, DatePipe, RouterLink, NgIcon, TranslocoPipe, EventDate, ListState],
  viewProviders: [provideIcons({ lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './events-page.html',
})
export class EventsPage {
  private readonly api = inject(ApiClient);

  /** Query parameter `?tab=archive`. */
  readonly tab = input<string>();

  protected readonly eventsPath = APP_ROUTES.me.events;
  protected readonly tabs = [
    { value: 'upcoming' as const, labelKey: 'me.events.upcoming' },
    { value: 'archive' as const, labelKey: 'me.events.archive' },
  ];
  protected readonly current = computed<EventsTab>(() => (this.tab() === 'archive' ? 'archive' : 'upcoming'));

  protected readonly list = cursorList({
    params: () => this.current(),
    fetch: (tab, cursor) =>
      tab === 'archive'
        ? this.api.get(apiUrl('me', 'archivedEvents'), archivedEventsResponseSchema, { cursor })
        : this.api.get(apiUrl('me', 'upcomingEvents'), upcomingEventsResponseSchema, { cursor }),
  });

  protected link(id: string): string {
    return appPath(APP_ROUTES.me.event, { eventId: id });
  }
}
