import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideClock } from '@ng-icons/lucide';

/** Placeholder for pages of later stages, so navigation and permissions can be tried out now. */
@Component({
  selector: 'vm-coming-soon-page',
  imports: [TranslocoPipe, NgIcon],
  viewProviders: [provideIcons({ lucideClock })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coming-soon-page.html',
})
export class ComingSoonPage {
  /** Route data (router input binding). */
  readonly titleKey = input.required<string>();
  readonly stage = input.required<number>();
}
