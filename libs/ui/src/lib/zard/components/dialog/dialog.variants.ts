import { cva, type VariantProps } from 'class-variance-authority';

/**
 * VM-Web: full screen below md (768 px), centered panel from md on. The width comes from
 * `--z-dialog-width` (set from `zWidth`), so an explicit width never squeezes the phone layout.
 * Header, content and footer are separate bands with their own padding (header and footer with
 * a border); every direct child without `data-slot` is a content band and gets the same padding.
 */
export const dialogVariants = cva([
  'fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-hidden bg-surface-container-low text-body-medium text-on-surface outline-none',
  '[&>:not([data-slot])]:px-5 [&>:not([data-slot])]:py-5 md:[&>:not([data-slot])]:px-6',
  'md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[90dvh] md:w-(--z-dialog-width) md:max-w-[calc(100%-2rem)] md:-translate-1/2',
  'md:rounded-extra-large md:shadow-level3',
]);

/** Classes of the mask behind a dialog, shared by the declarative form and the service. */
export const DIALOG_BACKDROP_CLASSES = ['bg-scrim/32'];

// VM-Web: own band with room for the close button and the status bar; never shrinks.
export const dialogHeaderVariants = cva(
  'flex shrink-0 flex-col gap-1.5 border-b px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 pe-14 md:px-6 md:pt-5 md:pe-14',
);

export const dialogTitleVariants = cva('text-headline-small text-on-surface wrap-anywhere');

export const dialogDescriptionVariants = cva(
  'text-body-medium text-on-surface-variant wrap-anywhere *:[a]:underline *:[a]:underline-offset-[3px] *:[a]:hover:text-on-surface',
);

export const dialogFooterVariants = cva(
  // VM-Web: own band at the bottom of the full-screen dialog, respects the home indicator.
  'mt-auto flex shrink-0 flex-col-reverse gap-2 border-t px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:flex-row md:justify-end md:px-6 md:pb-4',
);

export type ZardDialogVariants = VariantProps<typeof dialogVariants>;
