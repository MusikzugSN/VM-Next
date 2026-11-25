import { expandPermissions } from '../seed/default-roles';
import { LibraryBuilder } from '../testing/library-builder';
import { createTestApp, type TestApp } from '../testing/test-app';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { FoldersController } from './folders.controller';
import { FoldersRepository } from './folders.repository';
import { FoldersService } from './folders.service';

describe.skipIf(!TEST_DATABASE_URL)('Mappen (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let t: TestApp;
  const ids = {} as Record<string, string>;
  const unknownId = '00000000-0000-7000-8000-000000000000';

  type Who = 'lib' | 'editor' | 'viewer' | 'youthLib' | 'none' | 'admin';

  beforeAll(async () => {
    testDb = await createTestDatabase('folders');
    const b = new LibraryBuilder(testDb.db);

    ids.root = await b.ensemble('Verein', null);
    ids.orchestra = await b.ensemble('Hauptorchester', ids.root);
    ids.windClass = await b.ensemble('Bläserklasse', ids.orchestra);
    ids.youth = await b.ensemble('Jugendorchester', ids.root);
    ids.archived = await b.ensemble('Altes Orchester', ids.orchestra, { archived: true });

    const roles = {
      librarian: await b.role('Notenwart:in', expandPermissions(['folder.*'])),
      editor: await b.role('Mappenpflege', ['folder.view', 'folder.edit']),
      viewer: await b.role('Lesend', ['folder.view']),
      musician: await b.role('Musiker:in', ['sheet.upload']),
    };
    for (const [name, ensemble, role] of [
      ['lib', ids.orchestra, roles.librarian],
      ['editor', ids.orchestra, roles.editor],
      ['viewer', ids.orchestra, roles.viewer],
      ['youthLib', ids.youth, roles.librarian],
      ['none', ids.orchestra, roles.musician],
    ] as const) {
      ids[name] = await b.user(name);
      await b.member(ids[name], ensemble, role);
    }
    ids.admin = await b.user('admin', { isAdmin: true });

    ids.march = await b.score('Alte Kameraden', 'Carl Teike');
    ids.polka = await b.score('Böhmischer Traum', 'Norbert Gälle');
    ids.hymn = await b.score('Highland Cathedral');

    ids.marchBook = await b.folder(ids.orchestra, 'Marschbuch');
    await b.inFolder(ids.marchBook, [[ids.march, '1']]);
    ids.windFolder = await b.folder(ids.windClass, 'Übungsheft');
    ids.youthFolder = await b.folder(ids.youth, 'Jugendmappe');

    t = await createTestApp({ controllers: [FoldersController], providers: [FoldersRepository, FoldersService] }, { database: testDb.db });
  });

  afterAll(async () => {
    await t?.close();
    await testDb?.close();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = async (who: Who, path: string, body?: unknown): Promise<{ status: number; body: any }> => {
    const headers: Record<string, string> = await t.loginAs({ userId: ids[who] });
    const init: RequestInit = { headers };
    if (body !== undefined) {
      init.method = 'POST';
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${t.baseUrl}/folders/${path}`, init);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  };

  const check = async (cases: Array<[Who, string, unknown, number]>) => {
    const failures: string[] = [];
    for (const [who, path, body, expected] of cases) {
      const res = await api(who, path, body);
      if (res.status !== expected) failures.push(`${who} ${body === undefined ? 'GET' : 'POST'} ${path}: ${res.status} (expected ${expected})`);
    }
    expect(failures).toEqual([]);
  };

  describe('Rechte (R-3, R-4, F-3)', () => {
    it('lässt Lesen nur im eigenen Ensemble zu, fremde Mappen sind 404', async () => {
      const reads = (folderId: string) => [`folders/${folderId}/details`, `folders/${folderId}/entries`];
      const cases: Array<[Who, string, unknown, number]> = [];
      for (const path of reads(ids.marchBook)) {
        cases.push(['lib', path, undefined, 200], ['editor', path, undefined, 200], ['viewer', path, undefined, 200], ['admin', path, undefined, 200]);
        cases.push(['youthLib', path, undefined, 404], ['none', path, undefined, 404]);
      }
      for (const path of reads(ids.windFolder)) cases.push(['lib', path, undefined, 200], ['viewer', path, undefined, 200], ['youthLib', path, undefined, 404]);
      for (const path of reads(ids.youthFolder)) cases.push(['youthLib', path, undefined, 200], ['lib', path, undefined, 404], ['admin', path, undefined, 200]);
      for (const path of reads(unknownId)) cases.push(['lib', path, undefined, 404]);
      cases.push(['admin', `folders/${unknownId}/details`, undefined, 404]);
      await check(cases);
    });

    it('verlangt folder.edit für Kandidaten und Änderungen, folder.delete fürs Löschen', async () => {
      const f = `folders/${ids.marchBook}`;
      const edits: Array<[string, unknown]> = [
        [`${f}/rename`, { name: 'x' }],
        [`${f}/set-visibility`, { showInMyArea: true }],
        [`${f}/add-score`, { scoreId: ids.hymn, number: '99' }],
        [`${f}/set-score-number`, { scoreId: ids.march, number: '99' }],
        [`${f}/remove-score`, { scoreId: ids.march }],
      ];
      const cases: Array<[Who, string, unknown, number]> = [
        ['lib', `${f}/score-candidates?q=a`, undefined, 200],
        ['editor', `${f}/score-candidates?q=a`, undefined, 200],
        ['viewer', `${f}/score-candidates?q=a`, undefined, 403],
        ['youthLib', `${f}/score-candidates?q=a`, undefined, 404],
        ['none', `${f}/score-candidates?q=a`, undefined, 404],
        ['viewer', `${f}/delete`, {}, 403],
        ['editor', `${f}/delete`, {}, 403],
        ['youthLib', `${f}/delete`, {}, 404],
        ['none', `${f}/delete`, {}, 404],
        ['lib', `folders/${ids.youthFolder}/delete`, {}, 404],
      ];
      for (const [path, body] of edits) cases.push(['viewer', path, body, 403], ['youthLib', path, body, 404], ['none', path, body, 404]);
      await check(cases);
      expect((await api('lib', `${f}/details`)).body).toMatchObject({ name: 'Marschbuch', showInMyArea: true, scoreCount: 1 });
    });

    it('legt Mappen nur in Ensembles mit folder.create an, auch in Unterensembles', async () => {
      await check([
        ['viewer', 'folders/create', { ensembleId: ids.orchestra, name: 'x' }, 403],
        ['editor', 'folders/create', { ensembleId: ids.orchestra, name: 'x' }, 403],
        ['lib', 'folders/create', { ensembleId: ids.youth, name: 'x' }, 404],
        ['none', 'folders/create', { ensembleId: ids.orchestra, name: 'x' }, 404],
        ['admin', 'folders/create', { ensembleId: unknownId, name: 'x' }, 404],
      ]);
      const sub = await api('lib', 'folders/create', { ensembleId: ids.windClass, name: 'Vorspielheft' });
      expect(sub.status).toBe(201);
      expect((await api('lib', `folders/${sub.body.id}/details`)).body).toMatchObject({ ensemble: { id: ids.windClass }, showInMyArea: false });
      expect((await api('lib', `folders/${sub.body.id}/delete`, {})).status).toBe(204);
    });

    it('bietet nur Ensembles mit folder.create zur Auswahl an', async () => {
      expect((await api('lib', 'ensemble-options')).body.items.map((e: { name: string; depth: number }) => [e.name, e.depth])).toEqual([
        ['Hauptorchester', 0],
        ['Bläserklasse', 1],
      ]);
      expect((await api('youthLib', 'ensemble-options')).body.items.map((e: { name: string }) => e.name)).toEqual(['Jugendorchester']);
      await check([
        ['viewer', 'ensemble-options', undefined, 403],
        ['editor', 'ensemble-options', undefined, 403],
        ['none', 'ensemble-options', undefined, 403],
      ]);
    });

    it('filtert die Mappenliste auf Ensembles mit folder.view', async () => {
      const names = async (who: Who, query = '') => (await api(who, `folder-list${query}`)).body.items.map((f: { name: string }) => f.name);
      expect(await names('viewer')).toEqual(['Übungsheft', 'Marschbuch']);
      expect(await names('youthLib')).toEqual(['Jugendmappe']);
      expect(await names('none')).toEqual([]);
      expect(await names('admin')).toEqual(['Übungsheft', 'Marschbuch', 'Jugendmappe']);
      expect(await names('lib', `?ensembleId=${ids.youth}`)).toEqual([]);
      expect(await names('lib', `?ensembleId=${ids.orchestra}`)).toEqual(['Marschbuch']);
      expect(await names('admin', '?q=heft')).toEqual(['Übungsheft']);
    });
  });

  describe('Mappen pflegen (N-5, N-15)', () => {
    it('verweigert Namensdoppel und archivierte Ensembles', async () => {
      expect((await api('lib', 'folders/create', { ensembleId: ids.orchestra, name: 'marschbuch' })).body.code).toBe('name-taken');
      expect((await api('lib', 'folders/create', { ensembleId: ids.windClass, name: 'Marschbuch' })).status).toBe(201);
      expect((await api('admin', 'folders/create', { ensembleId: ids.archived, name: 'x' })).body.errors).toEqual([{ path: '/body/ensembleId', code: 'archived' }]);
      expect((await api('editor', `folders/${ids.windFolder}/rename`, { name: 'marschbuch' })).body.code).toBe('name-taken');
      expect((await api('editor', `folders/${ids.marchBook}/rename`, { name: 'Marschheft' })).status).toBe(204);
      expect((await api('viewer', `folders/${ids.marchBook}/details`)).body.name).toBe('Marschheft');
      expect((await api('editor', `folders/${ids.marchBook}/rename`, { name: 'Marschbuch' })).status).toBe(204);
      expect((await api('admin', `folders/${unknownId}/rename`, { name: 'x' })).status).toBe(404);
    });

    it('fügt Stücke mit Nummern hinzu, sortiert natürlich und schlägt die nächste Nummer vor', async () => {
      const add = (scoreId: string, number: string, numberSuffix?: string) => api('editor', `folders/${ids.marchBook}/add-score`, { scoreId, number, numberSuffix });
      expect((await add(ids.polka, '10')).status).toBe(204);
      expect((await add(ids.hymn, '1', 'a')).status).toBe(204);
      expect((await add(ids.polka, '3')).body.code).toBe('conflict');
      expect((await add(ids.hymn, '10')).body.code).toBe('conflict');
      expect((await api('editor', `folders/${ids.windFolder}/add-score`, { scoreId: ids.hymn, number: '1' })).status).toBe(204);
      expect((await api('editor', `folders/${ids.windFolder}/add-score`, { scoreId: ids.polka, number: '1' })).body.code).toBe('name-taken');
      expect((await add(unknownId, '5')).status).toBe(404);

      const entries = (await api('viewer', `folders/${ids.marchBook}/entries`)).body.items;
      expect(entries.map((e: { number: string; numberSuffix: string | null; title: string }) => [e.number, e.numberSuffix, e.title])).toEqual([
        ['1', null, 'Alte Kameraden'],
        ['1', 'a', 'Highland Cathedral'],
        ['10', null, 'Böhmischer Traum'],
      ]);
      expect((await api('viewer', `folders/${ids.marchBook}/entries?q=1a`)).body.items.map((e: { title: string }) => e.title)).toEqual(['Highland Cathedral']);

      const page1 = (await api('viewer', `folders/${ids.marchBook}/entries?limit=2`)).body;
      expect(page1.items).toHaveLength(2);
      const page2 = (await api('viewer', `folders/${ids.marchBook}/entries?limit=2&cursor=${page1.nextCursor}`)).body;
      expect(page2).toMatchObject({ items: [{ title: 'Böhmischer Traum' }], nextCursor: null });

      const candidates = (await api('editor', `folders/${ids.marchBook}/score-candidates?q=traum`)).body;
      expect(candidates).toMatchObject({ items: [{ title: 'Böhmischer Traum', alreadyContained: true }], suggestedNumber: '11' });
      expect((await api('editor', `folders/${ids.youthFolder}/score-candidates?q=traum`)).status).toBe(404);
      expect((await api('youthLib', `folders/${ids.youthFolder}/score-candidates?q=traum`)).body).toMatchObject({
        items: [{ alreadyContained: false }],
        suggestedNumber: '1',
      });
    });

    it('nummeriert um, blendet ein und aus, entfernt Stücke und zählt sie', async () => {
      const f = `folders/${ids.marchBook}`;
      expect((await api('editor', `${f}/set-score-number`, { scoreId: ids.polka, number: '1' })).body.code).toBe('name-taken');
      expect((await api('editor', `${f}/set-score-number`, { scoreId: ids.polka, number: '2' })).status).toBe(204);
      expect((await api('editor', `${f}/set-score-number`, { scoreId: unknownId, number: '3' })).status).toBe(404);
      expect((await api('editor', `${f}/set-visibility`, { showInMyArea: false })).status).toBe(204);
      expect((await api('viewer', `${f}/details`)).body).toMatchObject({ showInMyArea: false, scoreCount: 3, ensemble: { id: ids.orchestra, name: 'Hauptorchester' } });
      expect((await api('editor', `${f}/remove-score`, { scoreId: ids.polka })).status).toBe(204);
      expect((await api('editor', `${f}/remove-score`, { scoreId: ids.polka })).status).toBe(404);
      expect((await api('viewer', `${f}/entries`)).body.items.map((e: { number: string }) => e.number)).toEqual(['1', '1']);
      expect((await api('admin', 'folder-list?q=marsch')).body.items.map((i: { scoreCount: number }) => i.scoreCount)).toEqual([0, 2]);
    });

    it('löscht Mappen mit ihren Einträgen', async () => {
      expect((await api('lib', `folders/${ids.marchBook}/delete`, {})).status).toBe(204);
      expect((await api('lib', `folders/${ids.marchBook}/details`)).status).toBe(404);
      expect((await api('lib', `folders/${ids.marchBook}/entries`)).status).toBe(404);
      expect((await api('admin', `folders/${ids.marchBook}/details`)).status).toBe(404);
    });
  });
});
