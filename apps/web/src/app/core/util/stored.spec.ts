import { ignoreStorageErrors, readStoredStrings } from './stored';

const storageWith = (value: string | null) => ({ getItem: () => value }) as unknown as Storage;

describe('readStoredStrings', () => {
  it('returns the strings of a stored list and drops other entries', () => {
    expect(readStoredStrings(() => storageWith('["a",1,"b",null]'), 'key')).toEqual(['a', 'b']);
  });

  it.each([null, '', '{"a":1}', '"text"', 'not json'])('treats %s as empty', (value) => {
    expect(readStoredStrings(() => storageWith(value), 'key')).toEqual([]);
  });

  it('returns an empty list when the storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    expect(readStoredStrings(blocked, 'key')).toEqual([]);
  });
});

describe('ignoreStorageErrors', () => {
  it('runs the write', () => {
    const write = vi.fn();
    ignoreStorageErrors(write);
    expect(write).toHaveBeenCalledOnce();
  });

  it('swallows errors of the write', () => {
    expect(() =>
      ignoreStorageErrors(() => {
        throw new DOMException('full', 'QuotaExceededError');
      }),
    ).not.toThrow();
  });
});
