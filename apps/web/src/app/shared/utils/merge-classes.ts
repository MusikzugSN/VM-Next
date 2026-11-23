import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

export type { ClassValue };

/** M3-Typrollen aus styles.css. Ohne diese Liste hielte tailwind-merge sie für Textfarben. */
const M3_TYPE_ROLES = [
  'display-large',
  'display-medium',
  'display-small',
  'headline-large',
  'headline-medium',
  'headline-small',
  'title-large',
  'title-medium',
  'title-small',
  'body-large',
  'body-medium',
  'body-small',
  'label-large',
  'label-medium',
  'label-small',
];

const twMerge = extendTailwindMerge({ extend: { theme: { text: M3_TYPE_ROLES } } });

/** Merges CVA variants with a consumer's `class` input, last write winning. */
export function mergeClasses(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
