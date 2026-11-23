import type { Readable } from 'node:stream';
import { ProblemException } from '../common/problem-details/problem.exception';

/** Reads a stored file; a missing file is logged (it should exist) and answered with 404. */
export async function readOrNotFound(
  storage: { read(key: string): Promise<Readable> },
  key: string,
  logger: { error(message: string): void },
  message: string,
): Promise<Readable> {
  try {
    return await storage.read(key);
  } catch {
    logger.error(message);
    throw ProblemException.notFound();
  }
}
