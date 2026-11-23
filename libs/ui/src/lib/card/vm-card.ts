import { computed, Directive, input } from '@angular/core';

import { cva, type VariantProps } from 'class-variance-authority';

const vmCardVariants = cva('rounded-medium text-on-surface', {
  variants: {
    variant: {
      outlined: 'border border-outline-variant bg-surface shadow-level0',
      filled: 'border border-transparent bg-surface-container-highest shadow-level0',
      elevated: 'border border-transparent bg-surface-container-low shadow-level1',
    },
  },
  defaultVariants: { variant: 'outlined' },
});

export type VmCardVariant = NonNullable<VariantProps<typeof vmCardVariants>['variant']>;

/**
 * M3 Card als Attribut, damit Element, Layout und Links der Seite unverändert bleiben.
 * Abstände und Layout setzt die Seite über ihre eigenen Klassen.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[vm-card]',
  host: { '[class]': 'classes()', '[attr.data-variant]': 'variant()' },
})
export class VmCard {
  readonly variant = input<VmCardVariant>('outlined');
  protected readonly classes = computed(() => vmCardVariants({ variant: this.variant() }));
}
