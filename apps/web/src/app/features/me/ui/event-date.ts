import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Day and short month on `primary-soft` (event cards, mockup „Start“); decorative, the date is also written out. */
@Component({
  selector: 'vm-event-date',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `
    <span class="flex size-12 flex-col items-center justify-center rounded-md bg-primary-soft text-primary">
      <span class="text-lg leading-[22px] font-semibold tabular-nums">{{ date() | date: 'd' }}</span>
      <span class="text-xs font-medium">{{ date() | date: 'MMM' }}</span>
    </span>
  `,
})
export class EventDate {
  /** ISO date `YYYY-MM-DD`. */
  readonly date = input.required<string>();
}
