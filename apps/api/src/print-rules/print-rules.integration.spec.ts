import { CSRF_HEADER, DEFAULT_PRINT_RULES, type PrintRule } from '@vm-web/shared';
import { eq } from 'drizzle-orm';
import { uuidv7 } from '../common/ids/uuid-v7';
import { ensemblePrintRules } from '../db/schema';
import { EnsemblesService } from '../system/ensembles.service';
import { SystemEnsemblesController } from '../system/system.controller';
import { LibraryBuilder } from '../testing/library-builder';
import { createTestApp, type TestApp } from '../testing/test-app';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { PrintRulesRepository } from './print-rules.repository';
import { PrintRulesService } from './print-rules.service';

const ORCHESTRA_RULES: PrintRule[] = [
  { fromPages: 1, mode: 'simplex' },
  { fromPages: 4, mode: 'duplex' },
];
const ROOT_RULES: PrintRule[] = [{ fromPages: 1, mode: 'duplex' }];

describe.skipIf(!TEST_DATABASE_URL)('Druckregeln (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let t: TestApp;
  const ids = {} as Record<string, string>;

  beforeAll(async () => {
    testDb = await createTestDatabase('print_rules');
    const b = new LibraryBuilder(testDb.db);
    ids.root = await b.ensemble('Verein', null);
    ids.orchestra = await b.ensemble('Hauptorchester', ids.root);
    ids.windClass = await b.ensemble('Bläserklasse', ids.orchestra);
    ids.youth = await b.ensemble('Jugendorchester', ids.root);
    await b.settings(ids.root);

    const editor = await b.role('Vorstand', ['ensemble.view', 'ensemble.edit']);
    const viewer = await b.role('Kassenwart:in', ['ensemble.view']);
    const musician = await b.role('Musiker:in', ['score.view', 'member.view']);
    ids.eva = await b.user('Eva');
    ids.vik = await b.user('Vik');
    ids.mo = await b.user('Mo');
    await b.member(ids.eva, ids.youth, editor);
    await b.member(ids.vik, ids.orchestra, viewer);
    await b.member(ids.mo, ids.orchestra, musician);

    t = await createTestApp(
      { controllers: [SystemEnsemblesController], providers: [PrintRulesRepository, PrintRulesService] },
      { database: testDb.db, providers: [{ provide: EnsemblesService, useValue: {} }] },
    );
  });

  afterAll(async () => {
    await t?.close();
    await testDb?.close();
  });

  type Who = 'eva' | 'vik' | 'mo';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = async (who: Who | null, path: string, body?: unknown): Promise<{ status: number; body: any }> => {
    const headers: Record<string, string> = who ? await t.loginAs({ userId: ids[who] }) : {};
    const init: RequestInit = { headers };
    if (body !== undefined) {
      init.method = 'POST';
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${t.baseUrl}/system/ensembles/${path}`, init);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  };
  const rulesOf = (ensembleId: string) => api('eva', `${ensembleId}/print-rules`);
  const setRules = (who: Who, ensembleId: string, rules: PrintRule[]) => api(who, `${ensembleId}/set-print-rules`, { rules });
  const resetRules = (who: Who, ensembleId: string) => api(who, `${ensembleId}/reset-print-rules`, {});

  describe('permissions (R-4, F-1)', () => {
    it('reads with ensemble.view and changes with ensemble.edit, club-wide', async () => {
      const matrix: Array<[Who | null, () => Promise<{ status: number }>, number]> = [
        [null, () => api(null, `${ids.orchestra}/print-rules`), 401],
        ['mo', () => api('mo', `${ids.orchestra}/print-rules`), 403],
        ['vik', () => api('vik', `${ids.orchestra}/print-rules`), 200],
        ['vik', () => api('vik', `${ids.youth}/print-rules`), 200],
        ['eva', () => api('eva', `${ids.orchestra}/print-rules`), 200],
        ['vik', () => setRules('vik', ids.orchestra, ORCHESTRA_RULES), 403],
        ['vik', () => resetRules('vik', ids.orchestra), 403],
        ['mo', () => setRules('mo', ids.orchestra, ORCHESTRA_RULES), 403],
      ];
      const failures: string[] = [];
      for (const [i, [who, call, expected]] of matrix.entries()) {
        const { status } = await call();
        if (status !== expected) failures.push(`#${i} ${who}: ${status} (expected ${expected})`);
      }
      expect(failures).toEqual([]);
      expect(await testDb.db.select().from(ensemblePrintRules)).toEqual([]);
    });

    it('requires the CSRF token for changes', async () => {
      const headers = await t.loginAs({ userId: ids.eva });
      delete headers[CSRF_HEADER];
      const res = await fetch(`${t.baseUrl}/system/ensembles/${ids.orchestra}/reset-print-rules`, { method: 'POST', headers });
      expect(res.status).toBe(403);
    });
  });

  describe('rules and inheritance (S-2, D-6, F-3)', () => {
    it('falls back to the shipped default without own rules anywhere', async () => {
      expect((await rulesOf(ids.windClass)).body).toEqual({ rules: [...DEFAULT_PRINT_RULES], own: false, inheritedFrom: null });
      expect(await t.app.get(PrintRulesService).effective(ids.windClass)).toEqual({ rules: [...DEFAULT_PRINT_RULES], source: null });
    });

    it('inherits the nearest ancestor with own rules', async () => {
      expect((await setRules('eva', ids.root, ROOT_RULES)).status).toBe(204);
      expect((await setRules('eva', ids.orchestra, ORCHESTRA_RULES)).status).toBe(204);

      expect((await rulesOf(ids.root)).body).toEqual({ rules: ROOT_RULES, own: true, inheritedFrom: null });
      expect((await rulesOf(ids.orchestra)).body).toEqual({ rules: ORCHESTRA_RULES, own: true, inheritedFrom: null });
      expect((await rulesOf(ids.windClass)).body).toEqual({ rules: ORCHESTRA_RULES, own: false, inheritedFrom: { id: ids.orchestra, name: 'Hauptorchester' } });
      expect((await rulesOf(ids.youth)).body).toEqual({ rules: ROOT_RULES, own: false, inheritedFrom: { id: ids.root, name: 'Verein' } });

      const service = t.app.get(PrintRulesService);
      expect(await service.effective(ids.windClass)).toEqual({ rules: ORCHESTRA_RULES, source: { id: ids.orchestra, name: 'Hauptorchester' } });
      expect(await service.effective(null)).toEqual({ rules: ROOT_RULES, source: { id: ids.root, name: 'Verein' } });
    });

    it('replaces the whole rule set instead of merging', async () => {
      const replacement: PrintRule[] = [
        { fromPages: 1, mode: 'duplex' },
        { fromPages: 2, mode: 'simplex' },
        { fromPages: 10, mode: 'duplex' },
      ];
      expect((await setRules('eva', ids.orchestra, replacement)).status).toBe(204);
      expect((await rulesOf(ids.orchestra)).body.rules).toEqual(replacement);
      expect(await testDb.db.select().from(ensemblePrintRules).where(eq(ensemblePrintRules.ensembleId, ids.orchestra))).toHaveLength(3);
      expect((await setRules('eva', ids.orchestra, ORCHESTRA_RULES)).status).toBe(204);
    });

    it('keeps one complete rule set when two requests replace it at the same time', async () => {
      const a: PrintRule[] = [
        { fromPages: 1, mode: 'simplex' },
        { fromPages: 3, mode: 'duplex' },
      ];
      const b: PrintRule[] = [
        { fromPages: 1, mode: 'duplex' },
        { fromPages: 5, mode: 'simplex' },
        { fromPages: 9, mode: 'duplex' },
      ];
      const results = await Promise.all([setRules('eva', ids.youth, a), setRules('eva', ids.youth, b), setRules('eva', ids.youth, a)]);
      expect(results.map((r) => r.status)).toEqual([204, 204, 204]);
      const stored = (await rulesOf(ids.youth)).body.rules;
      expect([a, b]).toContainEqual(stored);
      await resetRules('eva', ids.youth);
    });

    it('refuses incomplete or unordered rule sets', async () => {
      expect((await setRules('eva', ids.orchestra, [{ fromPages: 2, mode: 'duplex' }])).status).toBe(400);
      expect(
        (
          await setRules('eva', ids.orchestra, [
            { fromPages: 1, mode: 'simplex' },
            { fromPages: 1, mode: 'duplex' },
          ])
        ).status,
      ).toBe(400);
      expect((await setRules('eva', ids.orchestra, [])).status).toBe(400);
      expect((await rulesOf(ids.orchestra)).body.rules).toEqual(ORCHESTRA_RULES);
    });

    it('inherits again after a reset', async () => {
      expect((await resetRules('eva', ids.orchestra)).status).toBe(204);
      expect((await rulesOf(ids.orchestra)).body).toEqual({ rules: ROOT_RULES, own: false, inheritedFrom: { id: ids.root, name: 'Verein' } });
      expect((await rulesOf(ids.windClass)).body.inheritedFrom).toEqual({ id: ids.root, name: 'Verein' });
      expect((await resetRules('eva', ids.orchestra)).status).toBe(204);
    });

    it('answers 404 for unknown ensembles', async () => {
      const unknown = uuidv7();
      expect((await rulesOf(unknown)).status).toBe(404);
      expect((await setRules('eva', unknown, ROOT_RULES)).status).toBe(404);
      expect((await resetRules('eva', unknown)).status).toBe(404);
      expect(await testDb.db.select().from(ensemblePrintRules).where(eq(ensemblePrintRules.ensembleId, unknown))).toEqual([]);
    });
  });
});
