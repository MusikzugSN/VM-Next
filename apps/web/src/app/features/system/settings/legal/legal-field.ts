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
  templateUrl: './legal-field.html',
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
