import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideFileArchive, lucidePrinter } from '@ng-icons/lucide';
import { APP_ROUTES, apiUrl, myEventOverviewResponseSchema, myEventSetlistResponseSchema } from '@vm-web/shared';

import { ZardButtonComponent } from '@/shared/components/button';

import { PrintLauncher } from '../../core/actions/pending-features';
import { ApiClient } from '../../core/api/api-client';
import { cursorList } from '../../core/api/cursor-list';
import { eventZipUrl } from '../../core/api/urls';
import { VoiceContextStore } from '../../core/voices/voice-context.store';
import { ListState } from '../../shared/ui/list-state';
import { MemberScoreList } from './ui/member-score-list';
import { PageProblem } from '../../shared/ui/page-problem';

/** Event (M-5, M-6, M-7): setlist in playing order, ZIP and print. */
@Component({
  selector: 'vm-me-event-page',
  imports: [PluralPipe, DatePipe, RouterLink, NgIcon, TranslocoPipe, ZardButtonComponent, ListState, MemberScoreList, PageProblem],
  viewProviders: [provideIcons({ lucideChevronLeft, lucideFileArchive, lucidePrinter })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="eventsPath" class="inline-flex min-h-11 items-center gap-1 self-start font-medium no-underline md:hidden">
      <ng-icon name="lucideChevronLeft" aria-hidden="true" />{{ 'nav.me.events' | transloco }}
    </a>

    @if (overview.error()) {
      <vm-page-problem [error]="overview.error()" />
    } @else if (overview.hasValue()) {
      @let event = overview.value();
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <h1 class="text-[22px] leading-7 font-semibold md:text-2xl md:leading-8">{{ event.name }} · {{ event.date | date: 'EE dd.MM.yyyy' }}</h1>
          <p class="mt-2 text-muted-foreground">
            {{ event.ensemble.name }} · {{ 'me.event.setlistCount' | tPlural: event.scoreCount }} ·
            {{ 'me.list.pages' | tPlural: event.totalPages }}
          </p>
        </div>
        <div class="flex flex-col gap-2 md:flex-row-reverse">
          <a z-button [href]="zip()" download class="w-full md:w-auto">
            <ng-icon name="lucideFileArchive" aria-hidden="true" />{{ 'me.common.zip' | transloco }}
          </a>
          <button z-button zType="outline" type="button" class="w-full md:w-auto" (click)="print()">
            <ng-icon name="lucidePrinter" aria-hidden="true" />{{ 'common.print' | transloco }}
          </button>
        </div>
      </div>
      @if (event.missingCount > 0) {
        <p class="text-destructive-ink">{{ 'me.common.missingHint' | tPlural: event.missingCount }}</p>
      }
    }

    <section aria-labelledby="h-setlist" class="flex flex-col gap-4">
      <div class="flex items-baseline justify-between gap-2">
        <h2 id="h-setlist" class="text-lg font-semibold">{{ 'me.event.setlist' | transloco }}</h2>
        <span class="text-muted-foreground">{{ 'me.event.order' | transloco }}</span>
      </div>
      <vm-member-score-list [rows]="list.items()" numbering="position" [eventId]="eventId()" />
      <vm-list-state [list]="list" emptyKey="me.event.empty" />
    </section>
  `,
})
export class EventPage {
  private readonly api = inject(ApiClient);
  private readonly voices = inject(VoiceContextStore);
  private readonly printer = inject(PrintLauncher);

  /** Route parameter. */
  readonly eventId = input.required<string>();

  protected readonly eventsPath = APP_ROUTES.me.events;

  protected readonly overview = rxResource({
    params: () => ({ eventId: this.eventId(), voiceId: this.voices.overrideIds() }),
    stream: ({ params }) =>
      this.api.get(apiUrl('me', 'eventOverview', { eventId: params.eventId }), myEventOverviewResponseSchema, {
        voiceId: params.voiceId,
      }),
  });

  protected readonly list = cursorList({
    params: () => ({ eventId: this.eventId(), voiceId: this.voices.overrideIds() }),
    fetch: (p, cursor) =>
      this.api.get(apiUrl('me', 'eventSetlist', { eventId: p.eventId }), myEventSetlistResponseSchema, {
        cursor,
        voiceId: p.voiceId,
      }),
  });

  protected readonly zip = computed(() => eventZipUrl(this.eventId(), this.voices.overrideIds()));

  protected print(): void {
    this.printer.open({ eventId: this.eventId() });
  }
}
