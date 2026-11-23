import { computed, Directive, input } from '@angular/core';

import { cva, type VariantProps } from 'class-variance-authority';

const vmBadgeVariants = cva(
  'inline-flex items-center gap-spacing-xs rounded-small px-spacing-sm py-0.5 text-label-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-container text-on-surface-variant',
        primary: 'bg-primary-container text-on-primary-container',
        tertiary: 'bg-tertiary-container text-on-tertiary-container',
        error: 'bg-error-container text-on-error-container',
        success: 'bg-success-container text-on-success-container',
        warning: 'bg-warning-container text-on-warning-container',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type VmBadgeTone = NonNullable<VariantProps<typeof vmBadgeVariants>['tone']>;

/** Status- und Hinweis-Markierung auf einem Container-Farbpaar. Trägt immer Text, nie nur Farbe. */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[vm-badge]',
  host: { '[class]': 'classes()' },
})
export class VmBadge {
  readonly tone = input<VmBadgeTone>('neutral');
  protected readonly classes = computed(() => vmBadgeVariants({ tone: this.tone() }));
}

/**
 * Zähler an einem Button (M3 Large Badge). Abweichend von M3 in `primary` statt `error`,
 * weil er aktive Filter zählt und keinen Fehler meldet.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[vm-badge-count]',
  host: {
    class:
      'absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-spacing-xs text-label-small text-on-primary',
  },
})
export class VmBadgeCount {}
