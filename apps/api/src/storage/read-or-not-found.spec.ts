import { Readable } from 'node:stream';
import { ProblemException } from '../common/problem-details/problem.exception';
import { readOrNotFound } from './read-or-not-found';

describe('readOrNotFound', () => {
  it('returns the stream without logging', async () => {
    const stream = Readable.from(['x']);
    const logger = { error: vi.fn() };
    await expect(readOrNotFound({ read: async () => stream }, 'key', logger, 'missing')).resolves.toBe(stream);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs the message and answers 404 for a missing file', async () => {
    const logger = { error: vi.fn() };
    const failing = { read: () => Promise.reject(new Error('ENOENT')) };
    const error = await readOrNotFound(failing, 'key', logger, 'missing').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProblemException);
    expect((error as ProblemException).status).toBe(404);
    expect(logger.error).toHaveBeenCalledWith('missing');
  });
});
