import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import type { ValidationError } from '@vm-web/shared';
import type { z } from 'zod';
import { ProblemException } from '../problem-details/problem.exception';

/** RFC 6901 JSON Pointer from path segments. */
export function toJsonPointer(segments: readonly PropertyKey[]): string {
  return segments.map((s) => '/' + String(s).replace(/~/g, '~0').replace(/\//g, '~1')).join('');
}

const LOCATION: Record<ArgumentMetadata['type'], string> = {
  body: 'body',
  query: 'query',
  param: 'params',
  custom: 'custom',
};

/** Maps Zod issues to Problem Details `errors[]`, prefixed with the request location. */
export function toValidationErrors(issues: readonly z.core.$ZodIssue[], location: string): ValidationError[] {
  return issues.map((issue) => ({ path: toJsonPointer([location, ...issue.path]), code: issue.code }));
}

/**
 * Validates and transforms params, query or body with a schema from `@vm-web/shared`.
 *
 * @example
 * list(@Query(new ZodValidationPipe(upcomingEventsQuerySchema)) query: UpcomingEventsQuery)
 */
@Injectable()
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown, metadata: ArgumentMetadata): z.output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw ProblemException.validation(toValidationErrors(result.error.issues, LOCATION[metadata.type]));
  }
}
