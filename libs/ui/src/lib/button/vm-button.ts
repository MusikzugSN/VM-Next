import { ChangeDetectionStrategy, Component, computed, input, ViewEncapsulation } from '@angular/core';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoaderCircle } from '@ng-icons/lucide';

import { ZardButtonComponent } from '../zard/components/button';
import { mergeClasses } from '../zard/utils/merge-classes';
import { type VmButtonSize, type VmButtonVariant, vmButtonVariants, vmIconButtonVariants } from './vm-button.variants';

const TEMPLATE = `
  @if (zLoading()) {
    <ng-icon name="lucideLoaderCircle" class="animate-spin duration-2000" />
  }
  <ng-content />
`;

/**
 * M3-Button auf Basis von Zard: Verhalten, `zLoading` und `zDisabled` kommen aus `ZardButtonComponent`.
 * Deaktivieren immer über `[zDisabled]`, nie über `[disabled]`.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[vm-button], a[vm-button]',
  imports: [NgIcon],
  template: TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  viewProviders: [provideIcons({ lucideLoaderCircle })],
  host: { '[attr.data-variant]': 'variant()', '[attr.data-size]': 'size()' },
  exportAs: 'vmButton',
})
export class VmButton extends ZardButtonComponent {
  readonly variant = input<VmButtonVariant>('filled');
  readonly size = input<VmButtonSize>('default');

  protected override readonly classes = computed(() =>
    mergeClasses(
      vmButtonVariants({
        variant: this.variant(),
        size: this.size(),
        inactive: this.zDisabled() || this.zLoading(),
      }),
      this.class(),
    ),
  );
}

/** M3-Icon-Button. Braucht wegen des fehlenden Textes immer ein `aria-label`. */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[vm-icon-button], a[vm-icon-button]',
  imports: [NgIcon],
  template: TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  viewProviders: [provideIcons({ lucideLoaderCircle })],
  host: { '[attr.data-variant]': 'variant()', '[attr.data-size]': '"icon"' },
  exportAs: 'vmIconButton',
})
export class VmIconButton extends ZardButtonComponent {
  readonly variant = input<VmButtonVariant>('text');

  protected override readonly classes = computed(() =>
    mergeClasses(
      vmIconButtonVariants({
        variant: this.variant(),
        inactive: this.zDisabled() || this.zLoading(),
      }),
      this.class(),
    ),
  );
}
