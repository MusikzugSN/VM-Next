import { ProblemException } from '../problem-details/problem.exception';
import { assertKnownIds, assertNoDuplicates } from './id-list';

const errorsOf = (fn: () => void) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ProblemException);
    return error as ProblemException;
  }
  throw new Error('did not throw');
};

describe('assertNoDuplicates', () => {
  it('accepts unique ids', () => {
    expect(() => assertNoDuplicates(['a', 'b'], '/body/ids')).not.toThrow();
  });

  it('reports every repetition at its own index', () => {
    expect(errorsOf(() => assertNoDuplicates(['a', 'b', 'a', 'a'], '/body/ids'))).toMatchObject({
      errors: [
        { path: '/body/ids/2', code: 'duplicate' },
        { path: '/body/ids/3', code: 'duplicate' },
      ],
    });
  });
});

describe('assertKnownIds', () => {
  it('accepts known ids', () => {
    expect(() => assertKnownIds(['a'], new Set(['a']), '/body/ids', 'unknown_voice')).not.toThrow();
  });

  it('reports unknown ids at their index, also repeated ones', () => {
    expect(errorsOf(() => assertKnownIds(['x', 'a', 'x'], new Set(['a']), '/query/voiceId', 'unknown_voice'))).toMatchObject({
      errors: [
        { path: '/query/voiceId/0', code: 'unknown_voice' },
        { path: '/query/voiceId/2', code: 'unknown_voice' },
      ],
    });
  });
});
