import { ApiProblem } from './api-problem';

const problem = (status: number, code: string, errors?: { path: string; code: string }[]) => ({
  type: `urn:vm-web:problem:${code}`,
  title: 'Title',
  status,
  code,
  ...(errors ? { errors } : {}),
});

describe('ApiProblem.fromResponse', () => {
  it('takes code, status and errors from Problem Details', () => {
    const result = ApiProblem.fromResponse(409, problem(409, 'name-taken'));
    expect(result.code).toBe('name-taken');
    expect(result.status).toBe(409);
    expect(result.messageKey).toBe('errors.name-taken');
  });

  it('marks status 0 as network error', () => {
    expect(ApiProblem.fromResponse(0, null).code).toBe('network-error');
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [413, 'payload-too-large'],
    [500, 'internal-error'],
    [502, 'network-error'],
    [418, 'unknown'],
  ])('falls back on the status %i without Problem Details', (status, code) => {
    expect(ApiProblem.fromResponse(status, '<html>proxy error</html>').code).toBe(code);
  });

  it('does not trust unknown problem codes', () => {
    expect(ApiProblem.fromResponse(400, problem(400, 'made-up')).code).toBe('unknown');
  });
});

describe('ApiProblem.fieldErrors', () => {
  it('maps JSON pointers below the prefix to fields, first error wins', () => {
    const result = ApiProblem.fromResponse(
      400,
      problem(400, 'validation-failed', [
        { path: '/body/name', code: 'too_small' },
        { path: '/body/name', code: 'too_big' },
        { path: '/body/items/0/voiceId', code: 'invalid_type' },
        { path: '/query/limit', code: 'too_big' },
      ]),
    );
    expect(result.fieldErrors()).toEqual({ name: 'too_small', 'items/0/voiceId': 'invalid_type' });
    expect(result.fieldErrors('/query')).toEqual({ limit: 'too_big' });
  });
});
