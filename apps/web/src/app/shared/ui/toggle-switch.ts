import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** On/off switch (`role="switch"`) with a visible or screen-reader label, e.g. „In Mein Bereich anzeigen“. */
@Component({
  selector: 'vm-toggle-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="label()"
      [disabled]="disabled()"
      (click)="toggled.emit(!checked())"
      class="inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-50 xl:min-h-8"
    >
      <span
        aria-hidden="true"
        class="relative inline-flex h-5 w-9 items-center rounded-full border-2 transition-colors"
        [class]="checked() ? 'border-primary bg-primary' : 'border-input bg-background'"
      >
        <span
          class="absolute size-3.5 rounded-full transition-all"
          [class]="checked() ? 'left-[18px] bg-primary-foreground' : 'left-0.5 bg-input'"
        ></span>
      </span>
    </button>
  `,
})
export class ToggleSwitch {
  readonly checked = input.required<boolean>();
  /** Accessible name of the switch. */
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly toggled = output<boolean>();
}
