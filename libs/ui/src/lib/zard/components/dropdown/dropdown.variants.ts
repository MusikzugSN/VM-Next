import { cva, type VariantProps } from 'class-variance-authority';

export const dropdownContentVariants = cva([
  'z-50 min-w-32 max-h-96 overflow-x-hidden overflow-y-auto rounded-extra-small bg-surface-container py-spacing-sm text-on-surface',
  'shadow-level2 outline-none animate-in duration-100 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
]);

export const dropdownItemVariants = cva(
  'relative flex min-h-target cursor-default select-none items-center gap-spacing-sm px-spacing-md py-spacing-xs text-label-large text-on-surface outline-none transition-colors xl:min-h-target-compact hover:bg-on-surface/8 focus:bg-on-surface/12 data-highlighted:bg-on-surface/12 data-disabled:pointer-events-none data-disabled:text-on-surface/38 data-disabled:cursor-not-allowed [&_svg:not([class*=size-])]:size-icon-sm [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: '',
        destructive:
          'text-error hover:bg-error/8 focus:bg-error/12 focus:text-error data-highlighted:bg-error/12',
      },
      inset: {
        true: 'ps-7',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      inset: false,
    },
  },
);

export const dropdownSubContentVariants = cva([
  'z-50 min-w-24 max-h-96 overflow-x-hidden overflow-y-auto rounded-extra-small bg-surface-container py-spacing-sm text-on-surface',
  'shadow-level2 outline-none animate-in duration-100 fade-in-0 zoom-in-95',
]);

export const dropdownSubTriggerVariants = cva(
  'relative flex min-h-target cursor-default select-none items-center gap-spacing-sm px-spacing-md py-spacing-xs text-label-large text-on-surface outline-none transition-colors xl:min-h-target-compact hover:bg-on-surface/8 focus:bg-on-surface/12 data-highlighted:bg-on-surface/12 data-disabled:pointer-events-none data-disabled:text-on-surface/38 data-disabled:cursor-not-allowed [&_svg:not([class*=size-])]:size-icon-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 data-[state=open]:bg-on-surface/12',
  {
    variants: {
      inset: {
        true: 'ps-7',
        false: '',
      },
    },
    defaultVariants: {
      inset: false,
    },
  },
);

export const dropdownLabelVariants = cva(
  'relative flex items-center px-spacing-md py-spacing-xs text-label-medium text-on-surface-variant',
  {
    variants: {
      inset: {
        true: 'ps-7',
        false: '',
      },
    },
    defaultVariants: {
      inset: false,
    },
  },
);

export type ZardDropdownItemVariants = VariantProps<typeof dropdownItemVariants>;
export type ZardDropdownItemTypeVariants = NonNullable<ZardDropdownItemVariants['variant']>;
