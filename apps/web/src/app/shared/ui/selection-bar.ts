import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';

import { VmIconButton } from '@vm-web/ui';

import { PluralPipe } from '../../core/i18n/plural.pipe';

/**
 * Floating bar for actions on selected list rows (M-6, M-7): appears at the bottom while something
 * is selected, above the phone navigation. It floats, so the list does not move when it appears.
 * The actions are projected: `<vm-selection-bar [count]="n" (cleared)="…"><button vm-button …>`.
 */
@Component({
  selector: 'vm-selection-bar',
  imports: [NgIcon, TranslocoPipe, PluralPipe, VmIconButton],
  viewProviders: [provideIcons({ lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  templateUrl: './selection-bar.html',
})
export class SelectionBar {
  readonly count = input.required<number>();
  readonly cleared = output<void>();
}
