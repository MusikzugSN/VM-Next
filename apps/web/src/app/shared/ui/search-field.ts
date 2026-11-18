import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';

import { ZardInputComponent } from '@/shared/components/input';

/** Search field of the Design Guideline (Suchen & Filtern); the label can be visually hidden. */
@Component({
  selector: 'vm-search-field',
  imports: [NgIcon, TranslocoPipe, ZardInputComponent],
  viewProviders: [provideIcons({ lucideSearch })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col gap-1.5' },
  template: `
    <label class="flex flex-col gap-1.5">
      <span [class.sr-only]="hideLabel()" class="font-medium">{{ labelKey() | transloco }}</span>
      <span class="relative">
        <ng-icon name="lucideSearch" class="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          z-input
          type="search"
          class="ps-9"
          [attr.cdkFocusInitial]="focusInDialog() ? '' : null"
          [placeholder]="(placeholderKey() ?? labelKey()) | transloco"
          [value]="value()"
          (input)="value.set($any($event.target).value)"
        />
      </span>
    </label>
  `,
})
export class SearchField {
  readonly value = model('');
  readonly labelKey = input.required<string>();
  readonly placeholderKey = input<string | null>(null);
  readonly hideLabel = input(true);
  /** First field of a dialog: gets the focus when the dialog opens. */
  readonly focusInDialog = input(false);
}
