import { ProblemException } from '../common/problem-details/problem.exception';

/** MySQL `ER_DUP_ENTRY` (1062), also when wrapped by drizzle (`cause`). */
export function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === 'ER_DUP_ENTRY') return true;
  }
  return false;
}

/** Runs a write; the unique index decides when two requests claim the same name at once. */
export async function withNameTaken<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) throw ProblemException.conflict('name-taken');
    throw error;
  }
}
