import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { CustomFieldValue, FieldDefinition } from '@vm-web/shared';

/** Value of a custom field (N-2) as text: option labels, Ja/Nein, dates and numbers in German. */
@Component({
  selector: 'vm-field-value',
  imports: [DatePipe, DecimalPipe, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './field-value.html',
})
export class FieldValue {
  readonly field = input.required<FieldDefinition>();
  readonly value = input<CustomFieldValue | undefined>(null);

  protected readonly labels = computed(() => {
    const value = this.value();
    const ids = Array.isArray(value) ? value : value ? [String(value)] : [];
    return ids.map((id) => this.field().options.find((option) => option.id === id)?.label ?? id).join(', ');
  });

  protected isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
  }
}
