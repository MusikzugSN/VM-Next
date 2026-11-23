// VM-Web: Höhe 44 px (Touch), 36 px ab 1280 px nach Design Guideline.
import { cva } from 'class-variance-authority';

export const inputVariants = cva(
  'h-control xl:h-control-compact w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm',
);

export const inputGroupInputVariants = cva(
  'flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 disabled:bg-transparent aria-invalid:ring-0',
);
