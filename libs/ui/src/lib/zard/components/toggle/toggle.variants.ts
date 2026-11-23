// VM-Web: Höhe 44 px (Touch), 36 px ab 1280 px nach Design Guideline.
import { cva, type VariantProps } from 'class-variance-authority';

export const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
  {
    variants: {
      zType: {
        default: 'bg-transparent',
        outline: 'border border-input bg-transparent',
      },
      zSize: {
        default: 'h-control min-w-target xl:h-control-compact xl:min-w-9 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2',
        sm: "h-7 min-w-7 rounded-small px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2',
      },
    },
    defaultVariants: {
      zType: 'default',
      zSize: 'default',
    },
  },
);
export type ZardToggleTypeVariants = NonNullable<VariantProps<typeof toggleVariants>['zType']>;
export type ZardToggleSizeVariants = NonNullable<VariantProps<typeof toggleVariants>['zSize']>;
