import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputComponent } from '@/shared/components/input';

/** Max. length of a short name (`shortNameSchema`). */
export const NAME_MAX = 100;

/** Inline form for a name (tags, instruments: create, rename); focuses the field when shown, Esc cancels. */
@Component({
  selector: 'vm-name-form',
  imports: [TranslocoPipe, ZardButtonComponent, ZardInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-2 md:flex-row md:items-end" (submit)="$event.preventDefault(); submit()" (keydown.escape)="cancelled.emit()">
      <label class="flex flex-1 flex-col gap-1.5">
        <span class="font-medium">{{ labelKey() | transloco }}</span>
        <input #field z-input type="text" [maxLength]="max" [value]="name()" (input)="name.set($any($event.target).value)" required />
      </label>
      <div class="flex gap-2">
        <button z-button type="submit" class="flex-1 md:flex-none" [disabled]="!name().trim()">{{ submitKey() | transloco }}</button>
        <button z-button zType="secondary" type="button" class="flex-1 md:flex-none" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class NameForm {
  readonly labelKey = input.required<string>();
  readonly submitKey = input('common.create');
  readonly initial = input('');
  readonly saved = output<string>();
  readonly cancelled = output<void>();

  protected readonly max = NAME_MAX;
  protected readonly name = signal('');
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  constructor() {
    afterNextRender(() => {
      this.name.set(this.initial());
      this.field().nativeElement.focus();
    });
  }

  protected submit(): void {
    const name = this.name().trim();
    if (name) this.saved.emit(name);
  }
}
