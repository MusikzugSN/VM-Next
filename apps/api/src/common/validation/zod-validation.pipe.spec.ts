import { cursorQuerySchema, selectionZipBodySchema } from '@vm-web/shared';
import { z } from 'zod';
import { ProblemException } from '../problem-details/problem.exception';
import { toJsonPointer, ZodValidationPipe } from './zod-validation.pipe';

const ID = '0193f2a4-5b6c-7d8e-9f01-23456789abcd';

function errorsOf(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ProblemException);
    return (e as ProblemException).errors;
  }
  throw new Error('expected a ProblemException');
}

describe('ZodValidationPipe', () => {
  it('returns parsed data with defaults and coercion', () => {
    const pipe = new ZodValidationPipe(cursorQuerySchema);
    expect(pipe.transform({ limit: '20' }, { type: 'query' })).toEqual({ limit: 20 });
  });

  it('reports JSON pointers prefixed with the request location', () => {
    const pipe = new ZodValidationPipe(selectionZipBodySchema);
    const errors = errorsOf(() => pipe.transform({ scoreIds: [ID, 'nope'], substitutes: 'some' }, { type: 'body' }));
    expect(errors).toEqual([
      { path: '/body/scoreIds/1', code: 'invalid_format' },
      { path: '/body/substitutes', code: 'invalid_value' },
    ]);
  });

  it('uses /params for path parameters', () => {
    const pipe = new ZodValidationPipe(z.object({ folderId: z.uuid() }));
    expect(errorsOf(() => pipe.transform({ folderId: 'x' }, { type: 'param' }))).toEqual([
      { path: '/params/folderId', code: 'invalid_format' },
    ]);
  });

  it('escapes ~ and / in pointer segments', () => {
    expect(toJsonPointer(['body', 'customFields', 'a/b~c'])).toBe('/body/customFields/a~1b~0c');
  });
});
