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
  template: `
    <div>
      <h1 class="text-headline-small">{{ 'nav.me.events' | transloco }}</h1>
      <p class="mt-2 text-muted-foreground">{{ 'me.events.intro' | transloco }}</p>
    </div>

    <nav [attr.aria-label]="'me.events.view' | transloco" class="inline-flex self-start rounded-medium bg-muted p-1">
      @for (t of tabs; track t.value) {
        <a
          [routerLink]="eventsPath"
          [queryParams]="{ tab: t.value === 'archive' ? 'archive' : null }"
          [attr.aria-current]="current() === t.value ? 'page' : null"
          class="inline-flex min-h-target items-center rounded-small px-4 font-medium text-foreground no-underline xl:min-h-target-compact"
          [class.bg-background]="current() === t.value"
          [class.shadow-sm]="current() === t.value"
          >{{ t.labelKey | transloco }}</a
        >
      }
    </nav>

    <ul class="flex flex-col gap-2">
      @for (event of list.items(); track event.id) {
        <li>
          <a
            [routerLink]="link(event.id)" vm-card class="flex items-center gap-3 p-4 text-foreground no-underline hover:bg-accent md:p-4"
          >
            <vm-event-date [date]="event.date" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="text-title-medium font-medium">{{ event.name }}</span>
              <span class="text-muted-foreground">{{ event.date | date: 'EEEE, d.M.yyyy' }} · {{ event.ensemble.name }}</span>
            </span>
            <span class="hidden text-muted-foreground tabular-nums md:inline">{{
              'me.common.scoreCount' | tPlural: event.scoreCount
            }}</span>
            <ng-icon name="lucideChevronRight" class="shrink-0 text-muted-foreground" aria-hidden="true" />
          </a>
        </li>
      }
    </ul>
    <vm-list-state [list]="list" [emptyKey]="current() === 'archive' ? 'me.events.emptyArchive' : 'me.events.empty'" />
  `,
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
