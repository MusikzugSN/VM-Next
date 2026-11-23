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
  template: `
    @if (value().total > 0) {
      <span
        class="inline-flex items-center gap-1 rounded-small px-2 py-0.5 text-label-medium whitespace-nowrap tabular-nums"
        [class]="complete() ? 'bg-success-soft text-success-ink' : 'bg-warning-soft text-warning-ink'"
        [attr.aria-label]="'library.completeness.label' | transloco: { present: value().present, total: value().total }"
      >
        <ng-icon [name]="complete() ? 'lucideCircleCheck' : 'lucideCircleAlert'" size="var(--mat-sys-icon-size-xs)" aria-hidden="true" />
        {{ value().present }}/{{ value().total }}
        @if (withWord()) {
          {{ 'library.completeness.voices' | transloco }}
        }
      </span>
    } @else {
      <span class="text-muted-foreground" [attr.aria-label]="'library.completeness.noLineup' | transloco">–</span>
    }
  `,
})
export class CompletenessBadge {
  readonly value = input.required<CompletenessSummary>();
  readonly withWord = input(false);

  protected readonly complete = computed(() => this.value().present >= this.value().total);
}
