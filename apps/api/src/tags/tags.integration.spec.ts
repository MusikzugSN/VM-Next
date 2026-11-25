import { expandPermissions } from '../seed/default-roles';
import { LibraryBuilder } from '../testing/library-builder';
import { createTestApp, type TestApp } from '../testing/test-app';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { TagsController } from './tags.controller';
import { TagsRepository } from './tags.repository';
import { TagsService } from './tags.service';

const UNKNOWN_ID = '01900000-0000-7000-8000-000000000999';

describe.skipIf(!TEST_DATABASE_URL)('Vereinstags (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let t: TestApp;
  const ids = {} as Record<string, string>;

  beforeAll(async () => {
    testDb = await createTestDatabase('tags');
    const b = new LibraryBuilder(testDb.db);

    ids.root = await b.ensemble('Verein', null);
    ids.orchestra = await b.ensemble('Hauptorchester', ids.root);
    ids.youth = await b.ensemble('Jugendorchester', ids.root);

    const roles = {
      librarian: await b.role('Notenwart:in', expandPermissions(['tag.*'])),
      reader: await b.role('Lesend', ['tag.view']),
      musician: await b.role('Musiker:in', ['sheet.upload']),
    };
    for (const [name, ensemble, role] of [
      ['lib', ids.youth, roles.librarian],
      ['reader', ids.orchestra, roles.reader],
      ['mus', ids.orchestra, roles.musician],
    ] as const) {
      ids[name] = await b.user(name);
      await b.member(ids[name], ensemble, role);
    }

    ids.march = await b.score('Florentiner Marsch');
    ids.polka = await b.score('Böhmischer Traum');
    ids.marchTag = await b.clubTag('Marsch', [ids.march, ids.polka]);
    ids.polkaTag = await b.clubTag('Polka', [ids.polka]);

    t = await createTestApp({ controllers: [TagsController], providers: [TagsRepository, TagsService] }, { database: testDb.db });
  });

  afterAll(async () => {
    await t?.close();
    await testDb?.close();
  });

  type Who = 'lib' | 'reader' | 'mus';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = async (who: Who | null, path: string, body?: unknown): Promise<{ status: number; body: any }> => {
    const headers: Record<string, string> = who ? await t.loginAs({ userId: ids[who] }) : {};
    const init: RequestInit = { headers };
    if (body !== undefined) {
      init.method = 'POST';
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${t.baseUrl}/tags/${path}`, init);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  };

  describe('Rechte (R-4, F-1)', () => {
    it.each<[Who | null, string, unknown, number]>([
      [null, 'club-tag-list', undefined, 401],
      ['lib', 'club-tag-list', undefined, 200],
      ['reader', 'club-tag-list', undefined, 200],
      ['mus', 'club-tag-list', undefined, 403],
      ['reader', 'club-tags/create', { name: 'Rechte' }, 403],
      ['mus', 'club-tags/create', { name: 'Rechte' }, 403],
      ['reader', `club-tags/${UNKNOWN_ID}/rename`, { name: 'Rechte' }, 403],
      ['mus', `club-tags/${UNKNOWN_ID}/rename`, { name: 'Rechte' }, 403],
      ['reader', `club-tags/${UNKNOWN_ID}/delete`, {}, 403],
      ['mus', `club-tags/${UNKNOWN_ID}/delete`, {}, 403],
    ])('%s → %s = %i', async (who, path, body, status) => {
      expect((await api(who, path, body)).status).toBe(status);
    });

    it('Recht aus einem anderen Ensemble reicht für Vereinstags', async () => {
      const created = await api('lib', 'club-tags/create', { name: 'Ensemblefrei' });
      expect(created.status).toBe(201);
      expect((await api('lib', `club-tags/${created.body.id}/delete`, {})).status).toBe(204);
    });
  });

  describe('Liste (N-17)', () => {
    it('sortiert nach Name und zählt die Stücke', async () => {
      const res = await api('reader', 'club-tag-list');
      expect(res.body).toEqual({
        items: [
          { id: ids.marchTag, name: 'Marsch', scoreCount: 2 },
          { id: ids.polkaTag, name: 'Polka', scoreCount: 1 },
        ],
        nextCursor: null,
      });
    });

    it('filtert nach Suchbegriff', async () => {
      expect((await api('reader', 'club-tag-list?q=pol')).body.items.map((i: { name: string }) => i.name)).toEqual(['Polka']);
    });

    it('blättert mit Cursor', async () => {
      const first = await api('reader', 'club-tag-list?limit=1');
      expect(first.body.items.map((i: { name: string }) => i.name)).toEqual(['Marsch']);
      expect(first.body.nextCursor).toEqual(expect.any(String));
      const second = await api('reader', `club-tag-list?limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`);
      expect(second.body).toEqual({ items: [{ id: ids.polkaTag, name: 'Polka', scoreCount: 1 }], nextCursor: null });
    });

    it('lehnt einen kaputten Cursor ab', async () => {
      expect((await api('reader', 'club-tag-list?cursor=kaputt')).status).toBe(400);
    });
  });

  describe('Anlegen, Umbenennen, Löschen (N-17)', () => {
    it('legt an und liefert die Id', async () => {
      const res = await api('lib', 'club-tags/create', { name: 'Weihnachten' });
      expect(res.status).toBe(201);
      ids.xmasTag = res.body.id;
      expect((await api('lib', 'club-tag-list?q=Weih')).body.items).toEqual([{ id: ids.xmasTag, name: 'Weihnachten', scoreCount: 0 }]);
    });

    it('lehnt einen vergebenen Namen ohne Rücksicht auf Groß-/Kleinschreibung ab', async () => {
      const res = await api('lib', 'club-tags/create', { name: 'marsch' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('name-taken');
    });

    it('lehnt einen leeren Namen ab', async () => {
      expect((await api('lib', 'club-tags/create', { name: '' })).status).toBe(400);
    });

    it('benennt um', async () => {
      expect((await api('lib', `club-tags/${ids.xmasTag}/rename`, { name: 'Advent' })).status).toBe(204);
      expect((await api('lib', 'club-tag-list?q=Advent')).body.items).toEqual([{ id: ids.xmasTag, name: 'Advent', scoreCount: 0 }]);
    });

    it('lehnt Umbenennen auf einen vergebenen Namen ab', async () => {
      const res = await api('lib', `club-tags/${ids.xmasTag}/rename`, { name: 'POLKA' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('name-taken');
    });

    it('antwortet 404 für ein unbekanntes Tag', async () => {
      const rename = await api('lib', `club-tags/${UNKNOWN_ID}/rename`, { name: 'Neu' });
      expect(rename.status).toBe(404);
      expect(rename.body.code).toBe('not-found');
      const del = await api('lib', `club-tags/${UNKNOWN_ID}/delete`, {});
      expect(del.status).toBe(404);
      expect(del.body.code).toBe('not-found');
    });

    it('lehnt eine ungültige Id ab', async () => {
      expect((await api('lib', 'club-tags/keine-id/delete', {})).status).toBe(400);
    });

    it('löscht ein Tag samt Zuordnungen, die Stücke bleiben', async () => {
      expect((await api('lib', `club-tags/${ids.marchTag}/delete`, {})).status).toBe(204);
      const res = await api('lib', 'club-tag-list');
      expect(res.body.items).toEqual([
        { id: ids.xmasTag, name: 'Advent', scoreCount: 0 },
        { id: ids.polkaTag, name: 'Polka', scoreCount: 1 },
      ]);
      expect((await api('lib', `club-tags/${ids.marchTag}/delete`, {})).status).toBe(404);
    });
  });
});
