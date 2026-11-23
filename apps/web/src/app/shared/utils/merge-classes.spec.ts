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
});
