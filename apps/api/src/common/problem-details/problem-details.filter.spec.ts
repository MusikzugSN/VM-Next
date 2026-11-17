import { ArgumentsHost, Logger, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { problemDetailsSchema } from '@vm-web/shared';
import { ProblemDetailsFilter, toProblemDetails } from './problem-details.filter';
import { ProblemException } from './problem.exception';

describe('toProblemDetails', () => {
  it('renders a ProblemException with code, detail and errors', () => {
    const body = toProblemDetails(
      ProblemException.validation([{ path: '/body/name', code: 'too_small' }]),
      '/internal/v1/folders/folders/create',
    );
    expect(problemDetailsSchema.parse(body)).toEqual({
      type: 'urn:vm-web:problem:validation-failed',
      title: 'Validation failed',
      status: 400,
      detail: 'Request does not match schema',
      instance: '/internal/v1/folders/folders/create',
      code: 'validation-failed',
      errors: [{ path: '/body/name', code: 'too_small' }],
    });
  });

  it('maps framework exceptions by status', () => {
    expect(toProblemDetails(new NotFoundException(), '/x')).toMatchObject({ status: 404, code: 'not-found' });
    expect(toProblemDetails(new PayloadTooLargeException(), '/x')).toMatchObject({
      status: 413,
      code: 'payload-too-large',
    });
  });

  it('maps express middleware errors (body-parser) by their status', () => {
    const err = Object.assign(new SyntaxError('Unexpected token } in JSON'), { status: 400 });
    expect(toProblemDetails(err, '/x')).toMatchObject({ status: 400, code: 'validation-failed' });
  });

  it('hides details of unexpected errors', () => {
    const body = toProblemDetails(new Error('connection string postgres://secret@db'), '/x');
    expect(body).toEqual({
      type: 'urn:vm-web:problem:internal-error',
      title: 'Internal error',
      status: 500,
      instance: '/x',
      code: 'internal-error',
    });
  });
});

describe('ProblemDetailsFilter', () => {
  function host(headersSent = false) {
    const res = {
      headersSent,
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
    const req = { method: 'GET', originalUrl: '/internal/v1/me/folders?limit=5' };
    const argumentsHost = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ArgumentsHost;
    return { res, argumentsHost };
  }

  it('sends application/problem+json without the query string in instance', () => {
    const { res, argumentsHost } = host();
    new ProblemDetailsFilter().catch(ProblemException.forbidden(), argumentsHost);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.type).toHaveBeenCalledWith('application/problem+json');
    expect(JSON.parse(res.send.mock.calls[0][0])).toMatchObject({ code: 'forbidden', instance: '/internal/v1/me/folders' });
  });

  it('aborts the connection when a stream already started', () => {
    const { res, argumentsHost } = host(true);
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    new ProblemDetailsFilter().catch(new Error('stream broke'), argumentsHost);
    expect(res.destroy).toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalledWith('GET /internal/v1/me/folders', expect.stringContaining('stream broke'));
    logged.mockRestore();
  });
});
