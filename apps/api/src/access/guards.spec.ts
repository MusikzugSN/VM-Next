import { Body, Controller, Get, Inject, OnModuleInit, Param, Post } from '@nestjs/common';
import { CSRF_HEADER, SESSION_COOKIE } from '@vm-web/shared';
import { ENS, type PersonKey } from '../testing/access-fixtures';
import { createTestApp, type TestApp } from '../testing/test-app';
import { Public, RequirePermission } from './decorators';
import { EnsembleResolvers } from './ensemble-resolvers';

const FOLDER_IN_ORCHESTRA = '20000000-0000-7000-8000-000000000001';
const FOLDER_IN_YOUTH = '20000000-0000-7000-8000-000000000002';
const MISSING_FOLDER = '20000000-0000-7000-8000-0000000000ff';

@Controller('t')
class GuardTestController implements OnModuleInit {
  constructor(@Inject(EnsembleResolvers) private readonly resolvers: EnsembleResolvers) {}

  onModuleInit() {
    const folders: Record<string, string> = { [FOLDER_IN_ORCHESTRA]: ENS.orchestra, [FOLDER_IN_YOUTH]: ENS.youth };
    this.resolvers.register('folder', async (id) => folders[id] ?? null);
  }

  @Public() @Get('public') pub() { return { ok: true }; }
  @Get('session-only') sessionOnly() { return { ok: true }; }
  @Post('write') write() { return { ok: true }; }
  @RequirePermission('user.view') @Get('club') club() { return { ok: true }; }
  @RequirePermission('score.edit') @Get('any-ensemble') anyEnsemble() { return { ok: true }; }
  @RequirePermission(['score.edit', 'config.edit']) @Get('any-of') anyOf() { return { ok: true }; }

  @RequirePermission('folder.view', { ensembleFrom: 'param:ensembleId' })
  @Get('ensembles/:ensembleId/folders')
  byParam(@Param('ensembleId') id: string) { return { id }; }

  @RequirePermission('folder.create', { ensembleFrom: 'body:ensembleId' })
  @Post('folders/create')
  byBody(@Body() body: { ensembleId: string }) { return { id: body.ensembleId }; }

  @RequirePermission('folder.edit', { ensembleFrom: { resolver: 'folder', from: 'param:folderId' } })
  @Post('folders/:folderId/rename')
  byResolver(@Param('folderId') id: string) { return { id }; }
}

describe('SessionGuard and PermissionGuard', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ controllers: [GuardTestController] });
  });
  afterAll(() => t.close());

  const call = async (person: PersonKey | null, method: 'GET' | 'POST', path: string, body?: unknown) => {
    const headers: Record<string, string> = person ? await t.loginAs(person) : {};
    if (body) headers['content-type'] = 'application/json';
    const res = await fetch(t.baseUrl + '/t/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: (await res.json()) as { code?: string; errors?: unknown } };
  };

  describe('session', () => {
    it('lets anyone reach public routes', async () => {
      expect((await call(null, 'GET', 'public')).status).toBe(200);
    });

    it('requires a session elsewhere (401 unauthenticated)', async () => {
      expect(await call(null, 'GET', 'session-only')).toMatchObject({ status: 401, body: { code: 'unauthenticated' } });
    });

    it('rejects unknown session cookies', async () => {
      const res = await fetch(t.baseUrl + '/t/session-only', { headers: { cookie: `${SESSION_COOKIE}=forged` } });
      expect(res.status).toBe(401);
      expect(res.headers.getSetCookie().join(';')).toContain(`${SESSION_COOKIE}=;`);
    });

    it('accepts any member, also without permissions and without membership', async () => {
      expect((await call('plainMember', 'GET', 'session-only')).status).toBe(200);
      expect((await call('noMembership', 'GET', 'session-only')).status).toBe(200);
    });

    it('rejects blocked accounts and ends their session (A-5)', async () => {
      const headers = await t.loginAs('blocked');
      const first = await fetch(t.baseUrl + '/t/session-only', { headers });
      expect(first.status).toBe(403);
      expect(await first.json()).toMatchObject({ code: 'account-blocked' });
      // the session is gone afterwards
      expect((await fetch(t.baseUrl + '/t/session-only', { headers })).status).toBe(401);
    });

    it('ignores a blocked session on public routes', async () => {
      const headers = await t.loginAs('blocked');
      expect((await fetch(t.baseUrl + '/t/public', { headers })).status).toBe(200);
    });
  });

  describe('CSRF', () => {
    it('accepts POST with the session token', async () => {
      expect((await call('musician', 'POST', 'write')).status).toBe(201);
    });

    it.each([
      ['missing', undefined],
      ['wrong', 'not-the-token'],
    ])('rejects POST with %s token (403 csrf-invalid)', async (_, token) => {
      const headers = await t.loginAs('musician');
      if (token) headers[CSRF_HEADER] = token;
      else delete headers[CSRF_HEADER];
      const res = await fetch(t.baseUrl + '/t/write', { method: 'POST', headers });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'csrf-invalid' });
    });
  });

  describe('permissions', () => {
    // [person, method, path, body, expected status]
    const cases: Array<[PersonKey, 'GET' | 'POST', string, unknown, number]> = [
      // club scope (R-4, F-1)
      ['musician', 'GET', 'club', undefined, 403],
      ['orchestraLibrarian', 'GET', 'club', undefined, 403],
      ['youthAdminRole', 'GET', 'club', undefined, 200],
      ['adminFlag', 'GET', 'club', undefined, 200],
      // any-ensemble scope
      ['musician', 'GET', 'any-ensemble', undefined, 403],
      ['youthBoard', 'GET', 'any-ensemble', undefined, 403],
      ['orchestraLibrarian', 'GET', 'any-ensemble', undefined, 200],
      ['adminFlag', 'GET', 'any-ensemble', undefined, 200],
      // any of several permissions
      ['youthAdminRole', 'GET', 'any-of', undefined, 200],
      ['orchestraLibrarian', 'GET', 'any-of', undefined, 200],
      ['youthBoard', 'GET', 'any-of', undefined, 403],
      // ensemble scope from a path parameter
      ['orchestraLibrarian', 'GET', `ensembles/${ENS.orchestra}/folders`, undefined, 200],
      ['orchestraLibrarian', 'GET', `ensembles/${ENS.windClass}/folders`, undefined, 200], // inherited (F-3)
      ['orchestraLibrarian', 'GET', `ensembles/${ENS.youth}/folders`, undefined, 404], // wrong ensemble
      ['rootLibrarian', 'GET', `ensembles/${ENS.youth}/folders`, undefined, 200],
      ['musician', 'GET', `ensembles/${ENS.orchestra}/folders`, undefined, 404], // member without right
      ['adminFlag', 'GET', `ensembles/${ENS.youth}/folders`, undefined, 200],
      // ensemble scope from the body
      ['orchestraLibrarian', 'POST', 'folders/create', { ensembleId: ENS.orchestra }, 201],
      ['orchestraLibrarian', 'POST', 'folders/create', { ensembleId: ENS.youth }, 404],
      ['youthBoard', 'POST', 'folders/create', { ensembleId: ENS.youth }, 404],
      // ensemble scope via resolver (element → ensemble)
      ['orchestraLibrarian', 'POST', `folders/${FOLDER_IN_ORCHESTRA}/rename`, {}, 201],
      ['orchestraLibrarian', 'POST', `folders/${FOLDER_IN_YOUTH}/rename`, {}, 404],
      ['orchestraLibrarian', 'POST', `folders/${MISSING_FOLDER}/rename`, {}, 404],
      ['adminFlag', 'POST', `folders/${FOLDER_IN_YOUTH}/rename`, {}, 201],
      // visible (folder.view) but not allowed (folder.edit) → 403 instead of 404
      ['orchestraViewer', 'POST', `folders/${FOLDER_IN_ORCHESTRA}/rename`, {}, 403],
      ['orchestraViewer', 'POST', `folders/${FOLDER_IN_YOUTH}/rename`, {}, 404],
      ['orchestraViewer', 'POST', 'folders/create', { ensembleId: ENS.orchestra }, 403],
    ];

    it.each(cases)('%s %s %s → %i', async (person, method, path, body, expected) => {
      const res = await call(person, method, path, body);
      expect(res.status).toBe(expected);
      if (expected === 403) expect(res.body.code).toBe('forbidden');
      if (expected === 404) expect(res.body.code).toBe('not-found');
    });

    it('validates the ensemble id before checking (400 with pointer)', async () => {
      const res = await call('orchestraLibrarian', 'POST', 'folders/create', { ensembleId: 'nope' });
      expect(res).toMatchObject({ status: 400, body: { errors: [{ path: '/body/ensembleId', code: 'invalid_format' }] } });
    });
  });
});
