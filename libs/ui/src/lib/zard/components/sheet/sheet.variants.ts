import { cva, type VariantProps } from 'class-variance-authority';

export const sheetVariants = cva(
  [
    'fixed z-50 flex flex-col gap-4',
    'bg-surface-container-low bg-clip-padding text-body-medium text-on-surface shadow-level3 outline-none',
  ],
  {
    variants: {
      zSide: {
        top: 'inset-x-0 top-0 h-auto border-b',
        right: 'inset-y-0 right-0 h-full w-3/4 rounded-s-large',
        bottom: 'inset-x-0 bottom-0 h-auto border-t',
        left: 'inset-y-0 left-0 h-full w-3/4 rounded-e-large',
      },
      zSize: {
        default: '',
        sm: '',
        lg: '',
        // Dimensions come from zWidth/zHeight as inline styles.
        custom: '',
      },
    },
    compoundVariants: [
      {
        zSide: ['left', 'right'],
        zSize: 'default',
        class: 'sm:max-w-sm',
      },
      {
        zSide: ['left', 'right'],
        zSize: 'sm',
        class: 'w-1/2 sm:max-w-xs',
      },
      {
        zSide: ['left', 'right'],
        zSize: 'lg',
        class: 'w-full sm:max-w-lg',
      },
      {
        zSide: ['top', 'bottom'],
        zSize: 'sm',
        class: 'h-1/3',
      },
      {
        zSide: ['top', 'bottom'],
        zSize: 'lg',
        class: 'h-3/4',
      },
    ],
    defaultVariants: {
      zSide: 'right',
      zSize: 'default',
    },
  },
);

/** Classes of the mask behind a sheet, shared by the declarative form and the service. */
export const SHEET_BACKDROP_CLASSES = ['bg-scrim/32'];

export const sheetHeaderVariants = cva('flex flex-col gap-0.5 p-4');

export const sheetTitleVariants = cva('text-title-medium text-on-surface wrap-anywhere');

export const sheetDescriptionVariants = cva('text-body-medium text-on-surface-variant wrap-anywhere');

export const sheetFooterVariants = cva('mt-auto flex flex-col gap-2 p-4');

export type ZardSheetVariants = VariantProps<typeof sheetVariants>;
