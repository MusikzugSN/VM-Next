import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import {
  PROBLEM_CONTENT_TYPE,
  PROBLEM_TYPE_PREFIX,
  type ProblemCode,
  type ProblemDetails,
} from '@vm-web/shared';
import type { Request, Response } from 'express';
import { ProblemException } from './problem.exception';

/** English short titles for logs and tooling; the UI translates `code`. */
const TITLES: Record<ProblemCode, string> = {
  'validation-failed': 'Validation failed',
  unauthenticated: 'Authentication required',
  'account-blocked': 'Account blocked',
  'csrf-invalid': 'CSRF token invalid',
  forbidden: 'Forbidden',
  'not-found': 'Not found',
  conflict: 'Conflict',
  'name-taken': 'Name already taken',
  'in-use': 'Still in use',
  'sheet-exists': 'Sheet already exists',
  'last-admin': 'Last administrator',
  'not-default-role': 'Not a default role',
  'upload-not-pending': 'Upload already decided',
  'root-ensemble': 'Root ensemble cannot be changed',
  'invalid-hierarchy': 'Invalid ensemble hierarchy',
  'unsupported-media-type': 'Unsupported media type',
  'payload-too-large': 'Payload too large',
  'login-failed': 'Login failed',
  'internal-error': 'Internal error',
};

/** Code for framework errors (`NotFoundException`, body-parser, multer …). */
export function codeForStatus(status: number): ProblemCode {
  switch (status) {
    case 400:
      return 'validation-failed';
    case 401:
      return 'unauthenticated';
    case 403:
      return 'forbidden';
    case 404:
    case 405:
      return 'not-found';
    case 409:
      return 'conflict';
    case 413:
      return 'payload-too-large';
    case 415:
      return 'unsupported-media-type';
    default:
      return status >= 500 ? 'internal-error' : 'validation-failed';
  }
}

/** Builds the Problem Details body for any thrown value. */
export function toProblemDetails(exception: unknown, instance: string): ProblemDetails {
  let status = 500;
  let code: ProblemCode = 'internal-error';
  let detail: string | undefined;
  let errors: ProblemDetails['errors'];

  if (exception instanceof ProblemException) {
    ({ status, code, errors } = exception);
    detail = status < 500 ? exception.detail : undefined;
  } else if (exception instanceof HttpException) {
    status = exception.getStatus();
    code = codeForStatus(status);
    // framework messages are technical English, safe to pass on below 500
    detail = status < 500 ? exception.message : undefined;
  } else if (isHttpError(exception)) {
    // errors from express middleware such as body-parser (malformed JSON, too large)
    status = exception.status;
    code = codeForStatus(status);
    detail = status < 500 ? exception.message : undefined;
  }

  return {
    type: PROBLEM_TYPE_PREFIX + code,
    title: TITLES[code],
    status,
    ...(detail ? { detail } : {}),
    instance,
    code,
    ...(errors ? { errors } : {}),
  };
}

function isHttpError(e: unknown): e is { status: number; message: string } {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as { status?: unknown }).status === 'number' &&
    (e as { status: number }).status >= 400 &&
    (e as { status: number }).status < 600 &&
    typeof (e as { message?: unknown }).message === 'string'
  );
}

/** Renders every error as `application/problem+json` (RFC 9457). Never leaks internals on 5xx. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ProblemDetails');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const instance = (req.originalUrl ?? req.url ?? '').split('?')[0];
    const body = toProblemDetails(exception, instance);

    if (body.status >= 500) {
      this.logger.error(`${req.method} ${instance}`, exception instanceof Error ? exception.stack : String(exception));
    }
    if (res.headersSent) {
      // a stream (PDF/ZIP) failed midway – nothing sensible can be sent any more
      res.destroy();
      return;
    }
    res.status(body.status).type(PROBLEM_CONTENT_TYPE).send(JSON.stringify(body));
  }
}
