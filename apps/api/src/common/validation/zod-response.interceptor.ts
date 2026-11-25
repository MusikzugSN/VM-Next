import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
  SetMetadata,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import type { z } from 'zod';
import { ProblemException } from '../problem-details/problem.exception';

export const RESPONSE_SCHEMA = 'vmweb:response-schema';

/** Declares the response schema of an endpoint; the returned value is parsed (unknown keys stripped). */
export const ResponseSchema = (schema: z.ZodType) => SetMetadata(RESPONSE_SCHEMA, schema);

/**
 * Validates handler results against `@ResponseSchema(...)`. A mismatch is a server bug:
 * it is logged with the issues and answered with 500 `internal-error`.
 */
@Injectable()
export class ZodResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ResponseSchema');

  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const schema = this.reflector.get<z.ZodType | undefined>(RESPONSE_SCHEMA, context.getHandler());
    if (!schema) return next.handle();

    return next.handle().pipe(
      map((value: unknown) => {
        if (value instanceof StreamableFile) return value;
        const result = schema.safeParse(value);
        if (result.success) return result.data;
        const handler = `${context.getClass().name}.${context.getHandler().name}`;
        this.logger.error(`Response of ${handler} does not match its schema: ${JSON.stringify(result.error.issues)}`);
        throw new ProblemException(500, 'internal-error', 'Response does not match schema');
      }),
    );
  }
}
