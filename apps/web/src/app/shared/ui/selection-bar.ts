import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@vm-web/ui/zard/components/button';

import { PluralPipe } from '../../core/i18n/plural.pipe';

/**
 * Floating bar for actions on selected list rows (M-6, M-7): appears at the bottom while something
 * is selected, above the phone navigation. It floats, so the list does not move when it appears.
 * The actions are projected: `<vm-selection-bar [count]="n" (cleared)="…"><button z-button …>`.
 */
@Component({
  selector: 'vm-selection-bar',
  imports: [NgIcon, TranslocoPipe, PluralPipe, ZardButtonComponent],
  viewProviders: [provideIcons({ lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @if (count() > 0) {
      <div
        role="region"
        [attr.aria-label]="'common.selection.label' | transloco"
        class="fixed inset-x-4 bottom-20 z-30 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3 shadow-lg md:inset-x-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:flex-nowrap"
      >
        <span class="flex-1 font-medium whitespace-nowrap md:me-4" aria-live="polite">{{ 'common.selection.count' | tPlural: count() }}</span>
        <ng-content />
        <button z-button zType="ghost" zSize="icon" type="button" (click)="cleared.emit()" [attr.aria-label]="'common.selection.clear' | transloco">
          <ng-icon name="lucideX" aria-hidden="true" />
        </button>
      </div>
    }
  `,
})
export class SelectionBar {
  readonly count = input.required<number>();
  readonly cleared = output<void>();
}
