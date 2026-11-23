import { cva } from 'class-variance-authority';

export const textareaVariants = cva(
  'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm',
);

export const inputGroupTextAreaVariants = cva(
  'flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none ring-0 disabled:bg-transparent aria-invalid:ring-0',
);
