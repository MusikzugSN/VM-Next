import { idSchema } from '@vm-web/shared';
import { uuidv7 } from './uuid-v7';

describe('uuidv7', () => {
  it('produces valid version 7 UUIDs', () => {
    const id = uuidv7();
    expect(idSchema.safeParse(id).success).toBe(true);
    expect(id[14]).toBe('7');
    expect(['8', '9', 'a', 'b']).toContain(id[19]);
  });

  it('encodes the timestamp in the first 48 bits', () => {
    const ms = Date.UTC(2030, 0, 1);
    const id = uuidv7(ms);
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(ms);
  });

  it('is strictly increasing, also within the same millisecond and when the clock goes back', () => {
    const fixed = Date.UTC(2031, 5, 1);
    const ids = [
      ...Array.from({ length: 5000 }, () => uuidv7(fixed)),
      uuidv7(fixed - 1000),
      uuidv7(fixed + 10_000),
    ];
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
