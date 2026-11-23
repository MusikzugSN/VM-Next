import { ChangeDetectionStrategy, Component, computed, Directive, forwardRef, ViewEncapsulation } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

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
