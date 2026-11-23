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

const M3_CORNERS = ['none', 'extra-small', 'small', 'medium', 'large', 'extra-large', 'full'];
const M3_LEVELS = ['level0', 'level1', 'level2', 'level3', 'level4', 'level5'];

const twMerge = extendTailwindMerge({
  extend: { theme: { text: M3_TYPE_ROLES, radius: M3_CORNERS, shadow: M3_LEVELS } },
});

/** Merges CVA variants with a consumer's `class` input, last write winning. */
export function mergeClasses(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
