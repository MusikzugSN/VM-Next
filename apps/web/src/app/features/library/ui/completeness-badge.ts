import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideCircleCheck } from '@ng-icons/lucide';
import type { CompletenessSummary } from '@vm-web/shared';

/** Vollständigkeit (N-4) „18/24“: below 100 % warning, at 100 % success (Design Guideline, Statusmuster). */
@Component({
  selector: 'vm-completeness-badge',
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCircleAlert, lucideCircleCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  templateUrl: './completeness-badge.html',
})
export class CompletenessBadge {
  readonly value = input.required<CompletenessSummary>();
  readonly withWord = input(false);

  protected readonly complete = computed(() => this.value().present >= this.value().total);
}
