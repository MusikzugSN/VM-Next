import { ChangeDetectionStrategy, Component, computed, Directive, forwardRef, input, ViewEncapsulation } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert } from '@ng-icons/lucide';
import type { ClassValue } from 'clsx';

import { ZardInputComponent } from '../zard/components/input';
import { ZardNativeSelectDirective } from '../zard/components/native-select';
import { ZardTextareaComponent } from '../zard/components/textarea';
import { mergeClasses } from '../zard/utils/merge-classes';
import { vmInputClasses, vmSelectClasses, vmTextareaClasses } from './vm-field.variants';

/** M3-Textfeld auf dem nativen `<input>`. Wert und Formular-Anbindung kommen aus Zard. */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'input[vm-input]',
  template: '',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => VmInput), multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  exportAs: 'vmInput',
})
export class VmInput extends ZardInputComponent {
  protected override readonly classes = computed(() => mergeClasses(vmInputClasses, this.class()));
}

/** Mehrzeiliges M3-Textfeld auf dem nativen `<textarea>`. */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'textarea[vm-textarea]',
  template: '',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => VmTextarea), multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  exportAs: 'vmTextarea',
})
export class VmTextarea extends ZardTextareaComponent {
  protected override readonly classes = computed(() => mergeClasses(vmTextareaClasses, this.class()));
}

/** Auswahlfeld in M3-Optik auf dem nativen `<select>`. */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'select[vm-select]',
  exportAs: 'vmSelect',
})
export class VmSelect extends ZardNativeSelectDirective {
  protected override readonly classes = computed(() => mergeClasses(vmSelectClasses, this.class()));
}

/** Rahmen eines Felds: Label, Steuerelement, Hinweis und Fehler untereinander. */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'label[vm-field]',
  host: { '[class]': 'classes()' },
})
export class VmField {
  readonly class = input<ClassValue>('');
  protected readonly classes = computed(() => mergeClasses('flex flex-col gap-1.5', this.class()));
}

/** Beschriftung eines Felds in `label-large`. */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'span[vm-field-label]',
  host: { class: 'text-label-large text-on-surface' },
})
export class VmFieldLabel {}

/** Fehlertext mit Icon, damit der Fehler nicht nur über die Farbe erkennbar ist. */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'span[vm-field-error]',
  imports: [NgIcon],
  viewProviders: [provideIcons({ lucideCircleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { '[class]': 'classes()' },
  template: `<ng-icon name="lucideCircleAlert" class="mt-px shrink-0" size="var(--mat-sys-icon-size-xs)" aria-hidden="true" /><span><ng-content /></span>`,
})
export class VmFieldError {
  readonly class = input<ClassValue>('');
  protected readonly classes = computed(() => mergeClasses('inline-flex items-start gap-spacing-xs text-body-small text-error', this.class()));
}
