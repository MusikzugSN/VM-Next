import { isApiProblem } from '../api/api-problem';

/**
 * `onProblem` for forms: shows `validation-failed` at the fields and focuses the first one.
 * Other problems stay unhandled, so `ActionRunner` shows them as a toast.
 */
export function fieldProblemHandler(
  errors: { set(value: Record<string, string>): void },
  focusInvalid: () => void,
): (problem: unknown) => boolean {
  return (problem) => {
    if (!isApiProblem(problem) || problem.code !== 'validation-failed') return false;
    errors.set(problem.fieldErrors());
    focusInvalid();
    return true;
  };
}
