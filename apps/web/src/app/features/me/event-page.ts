import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideFileArchive, lucidePrinter } from '@ng-icons/lucide';
import { APP_ROUTES, apiUrl, myEventOverviewResponseSchema, myEventSetlistResponseSchema } from '@vm-web/shared';

import { VmButton } from '@vm-web/ui';

import { PrintLauncher } from '../../core/actions/pending-features';
import { ApiClient } from '../../core/api/api-client';
import { cursorList } from '../../core/api/cursor-list';
import { eventZipUrl } from '../../core/api/urls';
import { VoiceContextStore } from '../../core/voices/voice-context.store';
import { ListState } from '../../shared/ui/list-state';
import { MemberScoreList } from './ui/member-score-list';
import { PageProblem } from '../../shared/ui/page-problem';
import { usePageName } from '../../core/layout/page';
import { selectOr } from '../../core/util/resource-value';

/** Event (M-5, M-6, M-7): setlist in playing order, ZIP and print. */
@Component({
  selector: 'vm-me-event-page',
  imports: [PluralPipe, DatePipe, RouterLink, NgIcon, TranslocoPipe, VmButton, ListState, MemberScoreList, PageProblem],
  viewProviders: [provideIcons({ lucideChevronLeft, lucideFileArchive, lucidePrinter })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './event-page.html',
})
export class EventPage {
  /** Breadcrumb and document title show the loaded element's name. */
  private readonly pageName = usePageName(() => selectOr(this.overview, (v) => v.name, null));
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
    const name = selectOr(this.overview, (v) => v.name, '');
    this.printer.open({ scope: 'event', id: this.eventId(), title: name });
  }
}
