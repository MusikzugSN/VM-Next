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
  template: `
    <h1 class="text-headline-small">{{ titleKey() | transloco }}</h1>
    <div class="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <span class="flex size-10 items-center justify-center rounded-lg bg-brass-soft text-brass-ink">
        <ng-icon name="lucideClock" aria-hidden="true" />
      </span>
      <p class="text-muted-foreground">{{ 'pages.comingSoon' | transloco: { stage: stage() } }}</p>
    </div>
  `,
})
export class ComingSoonPage {
  /** Route data (router input binding). */
  readonly titleKey = input.required<string>();
  readonly stage = input.required<number>();
}
