import type { Resource } from '@angular/core';

import { selectOr, valueOr } from './resource-value';

const withValue = <T>(value: T) => ({ hasValue: () => true, value: () => value }) as unknown as Resource<T>;
const failed = <T>() =>
  ({
    hasValue: () => false,
    value: () => {
      throw new Error('resource is in error state');
    },
  }) as unknown as Resource<T>;

describe('valueOr', () => {
  it('returns the value', () => {
    expect(valueOr(withValue(3), null)).toBe(3);
  });

  it('returns the fallback without reading the value', () => {
    expect(valueOr(failed<number>(), null)).toBeNull();
  });
});

describe('selectOr', () => {
  it('returns the selected part, also when it is null', () => {
    expect(selectOr(withValue({ name: 'A' }), (v) => v.name, '')).toBe('A');
    expect(selectOr(withValue({ name: null }), (v) => v.name, 'x')).toBeNull();
  });

  it('returns the fallback without reading the value', () => {
    const select = vi.fn();
    expect(selectOr(failed<{ name: string }>(), select, '')).toBe('');
    expect(select).not.toHaveBeenCalled();
  });
});
