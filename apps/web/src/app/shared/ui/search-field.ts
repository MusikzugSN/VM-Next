import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { VmInput } from '@vm-web/ui';


/** Search field of the Design Guideline (Suchen & Filtern); the label can be visually hidden. */
@Component({
  selector: 'vm-search-field',
  imports: [NgIcon, TranslocoPipe, VmInput],
  viewProviders: [provideIcons({ lucideSearch })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col gap-1.5' },
  templateUrl: './search-field.html',
})
export class SearchField {
  readonly value = model('');
  readonly labelKey = input.required<string>();
  readonly placeholderKey = input<string | null>(null);
  readonly hideLabel = input(true);
  /** First field of a dialog: gets the focus when the dialog opens. */
  readonly focusInDialog = input(false);
}
