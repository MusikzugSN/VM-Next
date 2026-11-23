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
  template: `
    <!-- The switch is a <button role="switch"> inside vm-switch: a labelable element, so a click on the text toggles it. -->
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
    <label class="flex cursor-pointer items-center justify-between gap-4 rounded-md border px-4 py-3" [class.opacity-60]="disabled()">
      <span class="flex min-w-0 flex-col">
        <span class="font-medium">{{ label() }}</span>
        @if (hint(); as text) {
          <span class="text-[13px] text-muted-foreground">{{ text }}</span>
        }
      </span>
      <vm-switch [checked]="checked()" [label]="label()" [disabled]="disabled()" (toggled)="toggled.emit($event)" />
    </label>
  `,
})
export class ToggleField {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly checked = input.required<boolean>();
  readonly disabled = input(false);
  readonly toggled = output<boolean>();
}
