import type { ProblemCode, ValidationError } from '@vm-web/shared';

/**
 * Domain error rendered as RFC 9457 Problem Details by `ProblemDetailsFilter`.
 * `detail` is an English hint for logs and developers, never a UI text.
 */
export class ProblemException extends Error {
  constructor(
    readonly status: number,
    readonly code: ProblemCode,
    readonly detail?: string,
    readonly errors?: ValidationError[],
  ) {
    super(detail ?? code);
    this.name = 'ProblemException';
  }

  static validation(errors: ValidationError[], detail = 'Request does not match schema'): ProblemException {
    return new ProblemException(400, 'validation-failed', detail, errors);
  }

  static unauthenticated(detail?: string): ProblemException {
    return new ProblemException(401, 'unauthenticated', detail);
  }

  static forbidden(detail?: string): ProblemException {
    return new ProblemException(403, 'forbidden', detail);
  }

  static notFound(detail?: string): ProblemException {
    return new ProblemException(404, 'not-found', detail);
  }

  static conflict(code: ProblemCode = 'conflict', detail?: string): ProblemException {
    return new ProblemException(409, code, detail);
  }
}
