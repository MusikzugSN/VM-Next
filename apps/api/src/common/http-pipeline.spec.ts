import { Body, Controller, Get, INestApplication, Post, Query } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { cursorQuerySchema, type CursorQuery } from '@vm-web/shared';
import { z } from 'zod';
import { ProblemDetailsFilter } from './problem-details/problem-details.filter';
import { ProblemException } from './problem-details/problem.exception';
import { ResponseSchema, ZodResponseInterceptor } from './validation/zod-response.interceptor';
import { ZodValidationPipe } from './validation/zod-validation.pipe';

const itemSchema = z.object({ name: z.string() });
const listSchema = z.object({ items: z.array(itemSchema), nextCursor: z.string().nullable() });

@Controller('test')
class TestController {
  @Get('list')
  @ResponseSchema(listSchema)
  list(@Query(new ZodValidationPipe(cursorQuerySchema)) query: CursorQuery) {
    return { items: [{ name: `limit ${query.limit}`, secret: 'stripped' }], nextCursor: null };
  }

  @Get('broken')
  @ResponseSchema(listSchema)
  broken() {
    return { items: 'not an array' };
  }

  @Post('create')
  create(@Body(new ZodValidationPipe(z.object({ name: z.string().min(1) }))) body: { name: string }) {
    if (body.name === 'taken') throw ProblemException.conflict('name-taken');
    return { id: '1' };
  }
}

describe('HTTP pipeline (filter, pipe, response schema)', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
        { provide: APP_INTERCEPTOR, useClass: ZodResponseInterceptor },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('internal/v1');
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/internal/v1/test`.replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  it('validates query, applies defaults and strips unknown response keys', async () => {
    const res = await fetch(`${base}/list`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [{ name: 'limit 50' }], nextCursor: null });
  });

  it('answers invalid query with 400 problem+json and JSON pointers', async () => {
    const res = await fetch(`${base}/list?limit=500`);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    expect(await res.json()).toMatchObject({
      code: 'validation-failed',
      instance: '/internal/v1/test/list',
      errors: [{ path: '/query/limit', code: 'too_big' }],
    });
  });

  it('answers malformed JSON bodies with 400 problem+json', async () => {
    const res = await fetch(`${base}/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"name":',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'validation-failed' });
  });

  it('passes domain errors through', async () => {
    const res = await fetch(`${base}/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'taken' }),
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'name-taken', type: 'urn:vm-web:problem:name-taken' });
  });

  it('answers unknown routes with 404 problem+json', async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'not-found' });
  });

  it('turns a response schema mismatch into 500 without details', async () => {
    const res = await fetch(`${base}/broken`);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ code: 'internal-error' });
    expect(body.detail).toBeUndefined();
  });
});
