import { ProblemException } from '../problem-details/problem.exception';

/** 400 with one `duplicate` error per repeated id, at its index below `pointer`. */
export function assertNoDuplicates(ids: readonly string[], pointer: string): void {
  const errors = ids.flatMap((id, i) => (ids.indexOf(id) !== i ? [{ path: `${pointer}/${i}`, code: 'duplicate' }] : []));
  if (errors.length) throw ProblemException.validation(errors);
}

/** 400 with one error per id that is not in `known`, at its index below `pointer`. */
export function assertKnownIds(ids: readonly string[], known: { has(id: string): boolean }, pointer: string, code: string): void {
  const errors = ids.flatMap((id, i) => (known.has(id) ? [] : [{ path: `${pointer}/${i}`, code }]));
  if (errors.length) throw ProblemException.validation(errors);
}
