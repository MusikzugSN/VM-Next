import { cva, type VariantProps } from 'class-variance-authority';

export const alertDialogVariants = cva(
  [
    'group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-1/2 gap-4',
    'rounded-extra-large bg-surface-container-low p-spacing-xl text-on-surface shadow-level3 outline-none',
    'data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm',
  ],
  {
    variants: {
      zSize: {
        default: '',
        sm: '',
      },
    },
    defaultVariants: {
      zSize: 'default',
    },
  },
);

/** Classes of the mask behind an alert dialog, shared by the declarative form and the service. */
export const ALERT_DIALOG_BACKDROP_CLASSES = ['bg-scrim/32'];

export const alertDialogHeaderVariants = cva([
  'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center',
  'has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4',
  'sm:group-data-[size=default]/alert-dialog-content:place-items-start',
  'sm:group-data-[size=default]/alert-dialog-content:text-start',
  'sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]',
]);

export const alertDialogTitleVariants = cva([
  'text-headline-small text-on-surface wrap-anywhere',
  'sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2',
]);

export const alertDialogDescriptionVariants = cva([
  'text-body-medium text-balance text-on-surface-variant wrap-anywhere md:text-pretty',
  '[&_a]:underline [&_a]:underline-offset-[3px] [&_a]:hover:text-on-surface',
]);

export const alertDialogFooterVariants = cva([
  'flex flex-col-reverse gap-2',
  'group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2',
  'sm:flex-row sm:justify-end',
]);

export const alertDialogMediaVariants = cva([
  'mb-2 inline-flex size-10 items-center justify-center rounded-full bg-surface-container',
  'sm:group-data-[size=default]/alert-dialog-content:row-span-2',
  "*:[svg:not([class*='size-'])]:size-6",
]);

export type ZardAlertDialogVariants = VariantProps<typeof alertDialogVariants>;
export type ZardAlertDialogSizeVariants = NonNullable<VariantProps<typeof alertDialogVariants>['zSize']>;
