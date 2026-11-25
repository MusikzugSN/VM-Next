import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { VmSwitch } from '@vm-web/ui';

/**
 * On/off setting as a row: label (and optional hint) on the left, switch on the right.
 * The whole row is a `<label>`, so a tap on the text toggles as well. Use it instead of a single
 * checkbox for settings like „In Mein Bereich anzeigen“.
 */
@Component({
  selector: 'vm-toggle-field',
  imports: [VmSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './toggle-field.html',
})
export class ToggleField {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly checked = input.required<boolean>();
  readonly disabled = input(false);
  readonly toggled = output<boolean>();
}
