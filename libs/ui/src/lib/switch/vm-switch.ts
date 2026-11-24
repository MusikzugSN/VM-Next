import { ChangeDetectionStrategy, Component, Directive, input, output } from '@angular/core';

/** Lucide `check` und `minus` in `on-primary`. In einer data-URL greifen keine CSS-Variablen. */
const CHECK =
  "checked:bg-[url(data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%23ffffff%27%20stroke-width%3D%274%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpath%20d%3D%27M20%206%209%2017l-5-5%27%2F%3E%3C%2Fsvg%3E)]";
const MINUS =
  "indeterminate:bg-[url(data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%23ffffff%27%20stroke-width%3D%274%27%20stroke-linecap%3D%27round%27%3E%3Cpath%20d%3D%27M5%2012h14%27%2F%3E%3C%2Fsvg%3E)]";

/** M3-Checkbox auf dem nativen `<input type="checkbox">`, Bindings und Tastatur bleiben nativ. */
@Directive({
  selector: 'input[type=checkbox][vm-checkbox]',
  host: {
    class: `size-[18px] shrink-0 cursor-pointer appearance-none rounded-extra-small border-2 border-on-surface-variant bg-transparent bg-center bg-no-repeat bg-size-[14px] transition-colors hover:border-on-surface checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary disabled:cursor-not-allowed disabled:border-on-surface/38 disabled:checked:border-transparent disabled:checked:bg-on-surface/38 ${CHECK} ${MINUS}`,
  },
})
export class VmCheckbox {}

/** M3-Schalter (`role="switch"`) mit Griff, der sich im eingeschalteten Zustand vergrößert. */
@Component({
  selector: 'vm-switch',
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
      class="inline-flex min-h-target min-w-target cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-38 xl:min-h-target-compact"
    >
      <span
        aria-hidden="true"
        class="relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors"
        [class]="checked() ? 'border-primary bg-primary' : 'border-outline bg-surface-container-highest'"
      >
        <span
          class="absolute rounded-full transition-all"
          [class]="checked() ? 'left-[22px] size-5 bg-on-primary' : 'left-1 size-3.5 bg-on-surface-variant'"
        ></span>
      </span>
    </button>
  `,
})
export class VmSwitch {
  readonly checked = input.required<boolean>();
  /** Zugänglicher Name des Schalters. */
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly toggled = output<boolean>();
}
