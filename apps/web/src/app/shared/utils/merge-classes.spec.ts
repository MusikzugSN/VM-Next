import { describe, expect, it } from 'vitest';

import { mergeClasses } from './merge-classes';

describe('mergeClasses mit M3-Typrollen', () => {
  it('behält Typrolle und Textfarbe nebeneinander', () => {
    expect(mergeClasses('text-body-medium', 'text-on-surface')).toBe('text-body-medium text-on-surface');
  });

  it('lässt die letzte Schriftgröße gewinnen', () => {
    expect(mergeClasses('text-sm', 'text-title-large')).toBe('text-title-large');
    expect(mergeClasses('text-label-small', 'text-body-large')).toBe('text-body-large');
  });

  it('behandelt M3-Formen und -Elevation als eigene Gruppen', () => {
    expect(mergeClasses('rounded-lg', 'rounded-medium')).toBe('rounded-medium');
    expect(mergeClasses('shadow-sm', 'shadow-level2')).toBe('shadow-level2');
    expect(mergeClasses('shadow-level1', 'shadow-primary')).toBe('shadow-level1 shadow-primary');
  });

  it('behandelt Größen-Tokens wie andere Maße', () => {
    expect(mergeClasses('h-control', 'h-9')).toBe('h-9');
    expect(mergeClasses('h-9', 'xl:h-control-compact', 'h-control')).toBe('xl:h-control-compact h-control');
    expect(mergeClasses('gap-2', 'gap-spacing-lg')).toBe('gap-spacing-lg');
    expect(mergeClasses('max-w-md', 'max-w-dialog-lg')).toBe('max-w-dialog-lg');
  });
});
