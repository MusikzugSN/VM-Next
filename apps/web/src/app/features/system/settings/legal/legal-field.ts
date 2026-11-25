import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { VmField, VmFieldError, VmFieldLabel, VmInput, VmTextarea } from '@vm-web/ui';

import { fieldLabelKey } from './legal-model';

let nextId = 0;

/** One labelled input of the legal form (S-7); label from `fields.<path>`, error from `validation.<code>`. */
@Component({
  selector: 'vm-legal-field',
  imports: [NgTemplateOutlet, TranslocoPipe, VmField, VmFieldLabel, VmFieldError, VmInput, VmTextarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ng-template #label><span vm-field-label>{{ labelKey() | transloco }}{{ required() ? ' *' : '' }}</span></ng-template>
    <ng-template #note>
      @if (error(); as e) {
        <span vm-field-error [id]="id + '-error'">{{ 'validation.' + e | transloco }}</span>
      } @else if (hintKey(); as hint) {
        <span [id]="id + '-hint'" class="text-body-medium text-muted-foreground">{{ hint | transloco }}</span>
      }
    </ng-template>
    @if (multiline()) {
      <label vm-field>
        <ng-container [ngTemplateOutlet]="label" />
        <textarea
          vm-textarea
          rows="5"
          [attr.maxlength]="maxlength()"
          [readOnly]="readonly()"
          [value]="text()"
          (input)="valueChange.emit($any($event.target).value)"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="describedBy()"
        ></textarea>
        <ng-container [ngTemplateOutlet]="note" />
      </label>
    } @else {
      <label vm-field>
        <ng-container [ngTemplateOutlet]="label" />
        <input
          vm-input
          [type]="type()"
          [attr.inputmode]="type() === 'number' ? 'numeric' : null"
          [attr.min]="type() === 'number' ? 0 : null"
          [attr.maxlength]="type() === 'number' ? null : maxlength()"
          [attr.autocomplete]="autocomplete()"
          [attr.placeholder]="placeholder()"
          [readOnly]="readonly()"
          [value]="text()"
          (input)="valueChange.emit($any($event.target).value)"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="describedBy()"
        />
        <ng-container [ngTemplateOutlet]="note" />
      </label>
    }
  `,
})
export class LegalField {
  /** Path below `system.settings.legal.fields`, e.g. `imprint.legalName`. */
  readonly path = input.required<string>();
  readonly value = input<string | number | null>(null);
  readonly error = input<string | undefined>(undefined);
  readonly hintKey = input<string | null>(null);
  readonly type = input<'text' | 'email' | 'tel' | 'url' | 'number'>('text');
  readonly maxlength = input(200);
  readonly multiline = input(false);
  readonly required = input(false);
  readonly readonly = input(false);
  readonly autocomplete = input<string | null>(null);
  readonly placeholder = input<string | null>(null);
  readonly valueChange = output<string>();

  protected readonly id = `legal-field-${nextId++}`;
  protected readonly labelKey = computed(() => fieldLabelKey(this.path()));
  protected readonly text = computed(() => {
    const v = this.value();
    return v === null ? '' : String(v);
  });
  protected readonly describedBy = computed(() => (this.error() ? `${this.id}-error` : this.hintKey() ? `${this.id}-hint` : null));
}
