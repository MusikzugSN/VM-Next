import { cva, type VariantProps } from 'class-variance-authority';

/**
 * M3 Common Buttons. Der State-Layer liegt als `::before` über der Fläche und nutzt die Textfarbe
 * mit den Deckkräften aus `--mat-sys-*-state-layer-opacity`.
 */
const base =
  "relative isolate inline-flex shrink-0 items-center justify-center gap-spacing-sm rounded-full border border-transparent text-label-large whitespace-nowrap select-none transition-[background-color,border-color,color] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:bg-current before:opacity-0 before:transition-opacity hover:before:opacity-(--mat-sys-hover-state-layer-opacity) focus-visible:before:opacity-(--mat-sys-focus-state-layer-opacity) active:before:opacity-(--mat-sys-pressed-state-layer-opacity) disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-icon-sm";

const inactiveFilled = 'bg-on-surface/12 text-on-surface/38';
const inactiveLine = 'bg-transparent text-on-surface/38';

const compoundVariants = [
  { variant: 'filled', inactive: true, class: inactiveFilled },
  { variant: 'tonal', inactive: true, class: inactiveFilled },
  { variant: 'danger', inactive: true, class: inactiveFilled },
  { variant: 'outlined', inactive: true, class: `${inactiveLine} border-on-surface/12` },
  { variant: 'text', inactive: true, class: inactiveLine },
] as const;

const variant = {
  filled: 'bg-primary text-on-primary',
  tonal: 'bg-secondary-container text-on-secondary-container',
  outlined: 'border-outline bg-transparent text-primary',
  text: 'bg-transparent text-primary',
  danger: 'bg-error text-on-error',
};

const inactive = { true: 'pointer-events-none' };

export const vmButtonVariants = cva(base, {
  variants: {
    variant,
    size: {
      default: 'h-control px-spacing-lg xl:h-control-compact',
      sm: 'h-target-compact px-spacing-md',
    },
    inactive,
  },
  compoundVariants: [...compoundVariants],
  defaultVariants: { variant: 'filled', size: 'default' },
});

export const vmIconButtonVariants = cva(`${base} size-control p-0 xl:size-control-compact`, {
  variants: {
    variant: { ...variant, text: 'bg-transparent text-on-surface-variant' },
    inactive,
  },
  compoundVariants: [...compoundVariants],
  defaultVariants: { variant: 'text' },
});

export type VmButtonVariant = NonNullable<VariantProps<typeof vmButtonVariants>['variant']>;
export type VmButtonSize = NonNullable<VariantProps<typeof vmButtonVariants>['size']>;
