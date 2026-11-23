import { sameMembers, toggled } from './sets';

describe('toggled', () => {
  it('adds at the end and removes, without changing the original', () => {
    const original = new Set(['a', 'b']);
    expect([...toggled(original, 'c')]).toEqual(['a', 'b', 'c']);
    expect([...toggled(original, 'a')]).toEqual(['b']);
    expect([...original]).toEqual(['a', 'b']);
  });

  it('does not add to a full set, but still removes', () => {
    const full = new Set(['a', 'b']);
    expect([...toggled(full, 'c', 2)]).toEqual(['a', 'b']);
    expect([...toggled(full, 'a', 2)]).toEqual(['b']);
  });
});

describe('sameMembers', () => {
  it('ignores the order', () => {
    expect(sameMembers(new Set([1, 2]), new Set([2, 1]))).toBe(true);
  });

  it('detects different values and sizes', () => {
    expect(sameMembers(new Set([1, 2]), new Set([1, 3]))).toBe(false);
    expect(sameMembers(new Set([1, 2]), new Set([1]))).toBe(false);
  });
});
