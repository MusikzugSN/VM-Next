import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Ref } from '@vm-web/shared';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';

export interface CreateInEnsemble {
  ensembleId: string;
  name: string;
  show: boolean;
  /** Events only. */
  date: string;
}

/** Inline form to create a folder or event in one of the allowed ensembles (N-15). */
@Component({
  selector: 'vm-create-in-ensemble-form',
  imports: [TranslocoPipe, ZardButtonComponent, ZardInputComponent, ZardNativeSelectDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-3 rounded-lg border border-dashed p-4" novalidate (submit)="$event.preventDefault(); submit()" (keydown.escape)="cancelled.emit()">
      <h2 class="font-semibold">{{ titleKey() | transloco }}</h2>
      <div class="grid gap-3 md:grid-cols-3">
        <label class="flex flex-col gap-1.5">
          <span class="font-medium">{{ 'library.common.name' | transloco }} *</span>
          <input #nameField z-input type="text" maxlength="100" [value]="name()" (input)="name.set($any($event.target).value)" />
        </label>
        @if (withDate()) {
          <label class="flex flex-col gap-1.5">
            <span class="font-medium">{{ 'library.events.date' | transloco }} *</span>
            <input z-input type="date" [value]="date()" (input)="date.set($any($event.target).value)" />
          </label>
        }
        <label class="flex flex-col gap-1.5">
          <span class="font-medium">{{ 'terms.ensemble' | transloco }} *</span>
          <select z-native-select [value]="ensembleId()" (change)="ensembleId.set($any($event.target).value)">
            @for (ensemble of ensembles(); track ensemble.id) {
              <option [value]="ensemble.id" [selected]="ensemble.id === ensembleId()">{{ ensemble.name }}</option>
            }
          </select>
        </label>
      </div>
      <label class="inline-flex min-h-11 items-center gap-2 xl:min-h-8">
        <input type="checkbox" class="size-4 accent-primary" [checked]="show()" (change)="show.set($any($event.target).checked)" />
        {{ 'library.common.showInMyArea' | transloco }}
      </label>
      <div class="flex flex-col gap-2 md:flex-row">
        <button z-button type="submit" [zDisabled]="!valid()">{{ 'common.create' | transloco }}</button>
        <button z-button zType="secondary" type="button" (click)="cancelled.emit()">{{ 'common.cancel' | transloco }}</button>
      </div>
    </form>
  `,
})
export class CreateInEnsembleForm {
  readonly titleKey = input.required<string>();
  readonly ensembles = input.required<readonly Ref[]>();
  readonly withDate = input(false);
  readonly created = output<CreateInEnsemble>();
  readonly cancelled = output<void>();

  protected readonly name = signal('');
  protected readonly date = signal('');
  protected readonly ensembleId = signal('');
  protected readonly show = signal(false);
  private readonly nameField = viewChild.required<string, ElementRef<HTMLInputElement>>('nameField', { read: ElementRef });

  constructor() {
    afterNextRender(() => {
      this.ensembleId.set(this.ensembles()[0]?.id ?? '');
      this.nameField().nativeElement.focus();
    });
  }

  protected valid(): boolean {
    return !!this.name().trim() && !!this.ensembleId() && (!this.withDate() || !!this.date());
  }

  protected submit(): void {
    if (!this.valid()) return;
    this.created.emit({ ensembleId: this.ensembleId(), name: this.name().trim(), show: this.show(), date: this.date() });
  }
}
