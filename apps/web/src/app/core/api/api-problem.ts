import { problemDetailsSchema, type ProblemCode, type ValidationError } from '@vm-web/shared';

/** Codes the client adds for failures without Problem Details from the API. */
export type ClientProblemCode = 'network-error' | 'unknown';

/**
 * An API failure as the frontend sees it: always a known code (for the i18n text under
 * `errors.<code>`), the HTTP status and, for `validation-failed`, the JSON pointers of the
 * invalid fields. The API never sends UI texts.
 */
export class ApiProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: ProblemCode | ClientProblemCode,
    readonly errors: readonly ValidationError[] = [],
  ) {
    super(`API problem ${status} ${code}`);
    this.name = 'ApiProblem';
  }

  /** i18n key of the general message, e.g. `errors.name-taken`. */
  get messageKey(): string {
    return `errors.${this.code}`;
  }

  /**
   * Validation codes per field below a pointer prefix, for forms:
   * `/body/name` + `/body/items/0/voiceId` → `{ name: 'too_small', 'items/0/voiceId': 'invalid_type' }`.
   * The first error of a field wins. The i18n text is `validation.<code>`.
   */
  fieldErrors(prefix = '/body'): Record<string, string> {
    const result: Record<string, string> = {};
    for (const { path, code } of this.errors) {
      if (!path.startsWith(`${prefix}/`)) continue;
      const field = path.slice(prefix.length + 1);
      result[field] ??= code;
    }
    return result;
  }

  /** Builds the problem from an HTTP status and the (already parsed) response body. */
  static fromResponse(status: number, body: unknown): ApiProblem {
    if (status === 0) return new ApiProblem(0, 'network-error');
    const parsed = problemDetailsSchema.safeParse(body);
    if (parsed.success) return new ApiProblem(parsed.data.status, parsed.data.code, parsed.data.errors ?? []);
    return new ApiProblem(status, fallbackCode(status));
  }
}

/** Code for responses that are not Problem Details (proxy errors, HTML pages, …). */
function fallbackCode(status: number): ProblemCode | ClientProblemCode {
  switch (status) {
    case 401:
      return 'unauthenticated';
    case 403:
      return 'forbidden';
    case 404:
      return 'not-found';
    case 413:
      return 'payload-too-large';
    case 502:
    case 503:
    case 504:
      return 'network-error';
    default:
      return status >= 500 ? 'internal-error' : 'unknown';
  }
}

export function isApiProblem(error: unknown): error is ApiProblem {
  return error instanceof ApiProblem;
}
