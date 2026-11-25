import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Day and short month on `primary-soft` (event cards, mockup „Start“); decorative, the date is also written out. */
@Component({
  selector: 'vm-event-date',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  templateUrl: './event-date.html',
})
export class EventDate {
  /** ISO date `YYYY-MM-DD`. */
  readonly date = input.required<string>();
}
