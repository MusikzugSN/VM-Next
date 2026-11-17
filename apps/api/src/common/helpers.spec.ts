import { compareNatural, naturalSortKey } from './natural-sort';
import { decodeCursor, encodeCursor, toPage } from './pagination/cursor';
import { ProblemException } from './problem-details/problem.exception';
import { todayIn } from './time/today';

describe('naturalSortKey (N-5)', () => {
  it('sorts folder numbers naturally', () => {
    const numbers = ['10', '2', '10a', 'A3', '1', '010', '9b', 'A10', 'a2'];
    expect([...numbers].sort(compareNatural)).toEqual(['1', '2', '9b', '10', '010', '10a', 'a2', 'A3', 'A10']);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(naturalSortKey(' A3 ')).toBe(naturalSortKey('a3'));
  });
});

describe('cursor', () => {
  it('round-trips keys', () => {
    const key = ['2026-12-24', 'abc', 3, null];
    expect(decodeCursor(encodeCursor(key), 4)).toEqual(key);
    expect(decodeCursor(undefined, 2)).toBeUndefined();
  });

  it.each(['not-base64-json', encodeCursor(['only-one']), Buffer.from('{"a":1}').toString('base64url')])(
    'rejects invalid cursor %s with 400 on /query/cursor',
    (cursor) => {
      try {
        decodeCursor(cursor, 2);
        throw new Error('expected error');
      } catch (e) {
        expect(e).toBeInstanceOf(ProblemException);
        expect((e as ProblemException).errors).toEqual([{ path: '/query/cursor', code: 'invalid_cursor' }]);
      }
    },
  );

  it('builds pages from limit + 1 rows', () => {
    const rows = [1, 2, 3].map((n) => ({ n }));
    const full = toPage(rows, 2, (r) => [r.n], (r) => r.n);
    expect(full.items).toEqual([1, 2]);
    expect(decodeCursor(full.nextCursor ?? undefined, 1)).toEqual([2]);
    expect(toPage(rows.slice(0, 2), 2, (r) => [r.n], (r) => r.n).nextCursor).toBeNull();
  });
});

describe('todayIn', () => {
  it('uses the club time zone, not UTC (M-5)', () => {
    const lateEvening = new Date('2026-12-24T23:30:00Z'); // already 25 Dec in Berlin
    expect(todayIn('Europe/Berlin', lateEvening)).toBe('2026-12-25');
    expect(todayIn('UTC', lateEvening)).toBe('2026-12-24');
  });
});
