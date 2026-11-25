import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

export interface LegalChoiceOption<T> {
  value: T;
  labelKey: string;
  hintKey?: string;
}

/** Single choice as a row of radio buttons (S-7: mode, operator, data processing agreement). */
@Component({
  selector: 'vm-legal-choice',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './legal-choice.html',
})
export class LegalChoice<T extends string | boolean> {
  readonly legendKey = input.required<string>();
  readonly options = input.required<readonly LegalChoiceOption<T>[]>();
  readonly value = input<T | null>(null);
  readonly required = input(false);
  readonly readonly = input(false);
  readonly valueChange = output<T>();
}
