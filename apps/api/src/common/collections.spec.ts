import { appendTo } from './collections';

describe('appendTo', () => {
  it('creates the list on first use and keeps the order', () => {
    const map = new Map<string, number[]>();
    appendTo(map, 'a', 1);
    appendTo(map, 'b', 2);
    appendTo(map, 'a', 3);
    expect([...map]).toEqual([
      ['a', [1, 3]],
      ['b', [2]],
    ]);
  });

  it('keeps null as its own key', () => {
    const map = new Map<string | null, number[]>();
    appendTo(map, null, 1);
    appendTo(map, 'null', 2);
    expect(map.get(null)).toEqual([1]);
    expect(map.get('null')).toEqual([2]);
  });
});
