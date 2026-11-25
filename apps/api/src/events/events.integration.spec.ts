import { todayIn } from '../common/time/today';
import { uuidv7 } from '../common/ids/uuid-v7';
import { expandPermissions } from '../seed/default-roles';
import { addDays, LibraryBuilder } from '../testing/library-builder';
import { createTestApp, type TestApp } from '../testing/test-app';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { EventsController } from './events.controller';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';

describe.skipIf(!TEST_DATABASE_URL)('Termine (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let t: TestApp;
  const ids = {} as Record<string, string>;
  const today = todayIn('Europe/Berlin');

  beforeAll(async () => {
    testDb = await createTestDatabase('events');
    const b = new LibraryBuilder(testDb.db);

    ids.root = await b.ensemble('Verein', null);
    ids.orchestra = await b.ensemble('Hauptorchester', ids.root);
    ids.windClass = await b.ensemble('Bläserklasse', ids.orchestra);
    ids.youth = await b.ensemble('Jugendorchester', ids.root);
    ids.archived = await b.ensemble('Altes Ensemble', ids.root, { archived: true });

    const roles = {
      board: await b.role('Vorstand', expandPermissions(['event.*'])),
      reader: await b.role('Lesend', ['event.view']),
      editor: await b.role('Bearbeitend', ['event.view', 'event.edit']),
      musician: await b.role('Musiker:in', ['sheet.upload']),
    };
    for (const [name, ensemble, role] of [
      ['chief', ids.root, roles.board],
      ['board', ids.orchestra, roles.board],
      ['reader', ids.orchestra, roles.reader],
      ['editor', ids.youth, roles.editor],
      ['mus', ids.orchestra, roles.musician],
    ] as const) {
      ids[name] = await b.user(name);
      await b.member(ids[name], ensemble, role);
    }

    ids.march = await b.score('Alte Kameraden', 'Carl Teike');
    ids.polka = await b.score('Böhmischer Traum', 'Norbert Gälle');
    ids.waltz = await b.score('Kaiserwalzer', 'Johann Strauss');

    ids.orchestraEvent = await b.event(ids.orchestra, 'Frühjahrskonzert', addDays(today, 5), false);
    ids.windEvent = await b.event(ids.windClass, 'Vorspiel', addDays(today, 3));
    ids.youthEvent = await b.event(ids.youth, 'Jugendkonzert', addDays(today, 7));
    ids.pastEvent = await b.event(ids.orchestra, 'Sommerfest', addDays(today, -10));
    await b.setlist(ids.orchestraEvent, [ids.march, ids.polka]);

    t = await createTestApp(
      { controllers: [EventsController], providers: [EventsService, EventsRepository] },
      { database: testDb.db, config: { APP_TIMEZONE: 'Europe/Berlin' } },
    );
  });

  afterAll(async () => {
    await t?.close();
    await testDb?.close();
  });

  type Who = 'chief' | 'board' | 'reader' | 'editor' | 'mus';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = async (who: Who, path: string, body?: unknown): Promise<{ status: number; body: any }> => {
    const headers: Record<string, string> = await t.loginAs({ userId: ids[who] });
    const init: RequestInit = { headers };
    if (body !== undefined) {
      init.method = 'POST';
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${t.baseUrl}/events/${path}`, init);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  };
  const names = (items: { name: string }[]) => items.map((i) => i.name);
  const setlistOf = async (eventId: string) =>
    (await api('board', `events/${eventId}/setlist`)).body.items.map((e: { position: number; scoreId: string }) => [e.position, e.scoreId]);

  describe('reading (N-15, N-16)', () => {
    it('offers ensembles with event.create, without archived ones (R-4, F-3)', async () => {
      expect(names((await api('board', 'ensemble-options')).body.items)).toEqual(['Hauptorchester', 'Bläserklasse']);
      expect(names((await api('chief', 'ensemble-options')).body.items)).not.toContain('Altes Ensemble');
      expect((await api('reader', 'ensemble-options')).status).toBe(403);
      expect((await api('mus', 'ensemble-options')).status).toBe(403);
    });

    it('lists upcoming events ascending and past ones descending, only of visible ensembles', async () => {
      const list = async (who: Who, query = '') => (await api(who, `event-list${query}`)).body.items;
      expect(names(await list('board'))).toEqual(['Vorspiel', 'Frühjahrskonzert']);
      expect(names(await list('reader'))).toEqual(['Vorspiel', 'Frühjahrskonzert']);
      expect(names(await list('editor'))).toEqual(['Jugendkonzert']);
      expect(names(await list('chief'))).toEqual(['Vorspiel', 'Frühjahrskonzert', 'Jugendkonzert']);
      expect(await list('mus')).toEqual([]);
      expect(names(await list('board', '?period=past'))).toEqual(['Sommerfest']);
      expect(names(await list('board', `?ensembleId=${ids.windClass}`))).toEqual(['Vorspiel']);
      expect(await list('board', `?ensembleId=${ids.youth}`)).toEqual([]);
      expect(names(await list('chief', '?q=konzert'))).toEqual(['Frühjahrskonzert', 'Jugendkonzert']);
      expect((await list('board')).find((e: { id: string }) => e.id === ids.orchestraEvent)).toMatchObject({
        ensemble: { id: ids.orchestra, name: 'Hauptorchester' },
        showInMyArea: false,
        scoreCount: 2,
      });
    });

    it('pages the event list with a cursor', async () => {
      const first = (await api('chief', 'event-list?limit=2')).body;
      expect(names(first.items)).toEqual(['Vorspiel', 'Frühjahrskonzert']);
      const second = (await api('chief', `event-list?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`)).body;
      expect(names(second.items)).toEqual(['Jugendkonzert']);
      expect(second.nextCursor).toBeNull();
    });

    it('shows details, setlist and candidates of an event', async () => {
      expect((await api('reader', `events/${ids.orchestraEvent}/details`)).body).toMatchObject({
        id: ids.orchestraEvent,
        name: 'Frühjahrskonzert',
        date: addDays(today, 5),
        ensemble: { id: ids.orchestra, name: 'Hauptorchester' },
        showInMyArea: false,
      });
      expect(await setlistOf(ids.orchestraEvent)).toEqual([
        [1, ids.march],
        [2, ids.polka],
      ]);
      const page = (await api('board', `events/${ids.orchestraEvent}/setlist?limit=1`)).body;
      expect(page.items.map((e: { title: string }) => e.title)).toEqual(['Alte Kameraden']);
      expect((await api('board', `events/${ids.orchestraEvent}/setlist?limit=1&cursor=${encodeURIComponent(page.nextCursor)}`)).body.items).toEqual([
        { position: 2, scoreId: ids.polka, title: 'Böhmischer Traum', composer: 'Norbert Gälle' },
      ]);
      expect((await api('board', `events/${ids.orchestraEvent}/score-candidates?q=a`)).body.items).toEqual([
        { id: ids.march, title: 'Alte Kameraden', composer: 'Carl Teike', alreadyContained: true },
        { id: ids.polka, title: 'Böhmischer Traum', composer: 'Norbert Gälle', alreadyContained: true },
        { id: ids.waltz, title: 'Kaiserwalzer', composer: 'Johann Strauss', alreadyContained: false },
      ]);
    });
  });

  describe('permissions (R-4, F-3)', () => {
    const matrix = (): Array<[Who, string, unknown, number]> => [
      ['board', `events/${ids.orchestraEvent}/details`, undefined, 200],
      ['board', `events/${ids.windEvent}/details`, undefined, 200],
      ['chief', `events/${ids.youthEvent}/details`, undefined, 200],
      ['reader', `events/${ids.orchestraEvent}/details`, undefined, 200],
      ['board', `events/${ids.youthEvent}/details`, undefined, 404],
      ['editor', `events/${ids.orchestraEvent}/details`, undefined, 404],
      ['mus', `events/${ids.orchestraEvent}/details`, undefined, 404],
      ['board', `events/${uuidv7()}/details`, undefined, 404],
      ['reader', `events/${ids.orchestraEvent}/setlist`, undefined, 200],
      ['mus', `events/${ids.orchestraEvent}/setlist`, undefined, 404],
      ['board', `events/${ids.youthEvent}/setlist`, undefined, 404],
      ['board', `events/${ids.orchestraEvent}/score-candidates?q=a`, undefined, 200],
      ['editor', `events/${ids.youthEvent}/score-candidates?q=a`, undefined, 200],
      ['reader', `events/${ids.orchestraEvent}/score-candidates?q=a`, undefined, 403],
      ['mus', `events/${ids.orchestraEvent}/score-candidates?q=a`, undefined, 404],
      ['board', `events/${ids.youthEvent}/score-candidates?q=a`, undefined, 404],
      ['reader', 'events/create', { ensembleId: ids.orchestra, name: 'x', date: today }, 403],
      ['editor', 'events/create', { ensembleId: ids.youth, name: 'x', date: today }, 403],
      ['mus', 'events/create', { ensembleId: ids.orchestra, name: 'x', date: today }, 404],
      ['board', 'events/create', { ensembleId: ids.youth, name: 'x', date: today }, 404],
      ['reader', `events/${ids.orchestraEvent}/update-details`, { name: 'x', date: today }, 403],
      ['mus', `events/${ids.orchestraEvent}/update-details`, { name: 'x', date: today }, 404],
      ['board', `events/${ids.youthEvent}/update-details`, { name: 'x', date: today }, 404],
      ['reader', `events/${ids.orchestraEvent}/set-visibility`, { showInMyArea: true }, 403],
      ['mus', `events/${ids.orchestraEvent}/set-visibility`, { showInMyArea: true }, 404],
      ['board', `events/${ids.youthEvent}/set-visibility`, { showInMyArea: true }, 404],
      ['reader', `events/${ids.orchestraEvent}/set-setlist`, { scoreIds: [] }, 403],
      ['mus', `events/${ids.orchestraEvent}/set-setlist`, { scoreIds: [] }, 404],
      ['board', `events/${ids.youthEvent}/set-setlist`, { scoreIds: [] }, 404],
      ['reader', `events/${ids.orchestraEvent}/delete`, {}, 403],
      ['editor', `events/${ids.youthEvent}/delete`, {}, 403],
      ['mus', `events/${ids.orchestraEvent}/delete`, {}, 404],
      ['board', `events/${ids.youthEvent}/delete`, {}, 404],
      ['board', `events/${uuidv7()}/delete`, {}, 404],
    ];

    it('allows and forbids as expected; events of other ensembles are 404', async () => {
      const failures: string[] = [];
      for (const [who, path, body, expected] of matrix()) {
        const res = await api(who, path, body);
        if (res.status !== expected) failures.push(`${who} ${path}: ${res.status} (expected ${expected})`);
      }
      expect(failures).toEqual([]);
      expect(await setlistOf(ids.orchestraEvent)).toEqual([
        [1, ids.march],
        [2, ids.polka],
      ]);
    });
  });

  describe('changing (N-15, N-16)', () => {
    it('creates events in active ensembles only', async () => {
      const created = await api('board', 'events/create', { ensembleId: ids.windClass, name: 'Probenwochenende', date: addDays(today, 20) });
      expect(created.status).toBe(200);
      expect((await api('board', `events/${created.body.id}/details`)).body).toMatchObject({
        name: 'Probenwochenende',
        ensemble: { id: ids.windClass },
        showInMyArea: false,
      });
      const archived = await api('chief', 'events/create', { ensembleId: ids.archived, name: 'x', date: today });
      expect(archived.status).toBe(400);
      expect(archived.body.errors).toEqual([{ path: '/body/ensembleId', code: 'archived' }]);
    });

    it('updates details and visibility', async () => {
      const before = (await api('board', `events/${ids.windEvent}/details`)).body.updatedAt;
      expect((await api('board', `events/${ids.windEvent}/update-details`, { name: 'Klassenvorspiel', date: addDays(today, 4) })).status).toBe(204);
      expect((await api('board', `events/${ids.windEvent}/set-visibility`, { showInMyArea: false })).status).toBe(204);
      const after = (await api('board', `events/${ids.windEvent}/details`)).body;
      expect(after).toMatchObject({ name: 'Klassenvorspiel', date: addDays(today, 4), showInMyArea: false });
      expect(after.updatedAt > before).toBe(true);
      expect((await api('editor', `events/${ids.youthEvent}/update-details`, { name: 'Jugendkonzert', date: addDays(today, 8) })).status).toBe(204);
    });

    it('replaces the setlist in playing order; duplicates and unknown scores are refused', async () => {
      expect((await api('board', `events/${ids.windEvent}/set-setlist`, { scoreIds: [ids.waltz, ids.march] })).status).toBe(204);
      expect(await setlistOf(ids.windEvent)).toEqual([
        [1, ids.waltz],
        [2, ids.march],
      ]);
      expect((await api('board', `events/${ids.windEvent}/set-setlist`, { scoreIds: [ids.march, ids.march] })).body.errors).toEqual([
        { path: '/body/scoreIds/1', code: 'duplicate' },
      ]);
      expect((await api('board', `events/${ids.windEvent}/set-setlist`, { scoreIds: [ids.march, uuidv7()] })).status).toBe(404);
      expect(await setlistOf(ids.windEvent)).toEqual([
        [1, ids.waltz],
        [2, ids.march],
      ]);
      expect((await api('board', `events/${ids.windEvent}/score-candidates?q=walzer`)).body.items).toEqual([
        { id: ids.waltz, title: 'Kaiserwalzer', composer: 'Johann Strauss', alreadyContained: true },
      ]);
      expect((await api('board', `events/${ids.windEvent}/set-setlist`, { scoreIds: [] })).status).toBe(204);
      expect(await setlistOf(ids.windEvent)).toEqual([]);
    });

    it('serializes concurrent setlist replacements of the same event', async () => {
      const orders = [
        [ids.march, ids.polka, ids.waltz],
        [ids.waltz, ids.polka],
        [ids.polka],
        [ids.march, ids.waltz],
      ];
      const results = await Promise.all(orders.map((scoreIds) => api('board', `events/${ids.windEvent}/set-setlist`, { scoreIds })));
      expect(results.map((r) => r.status)).toEqual([204, 204, 204, 204]);
      const final = (await setlistOf(ids.windEvent)).map(([, scoreId]: [number, string]) => scoreId);
      expect(orders).toContainEqual(final);
    });

    it('deletes an event together with its setlist', async () => {
      expect((await api('board', `events/${ids.orchestraEvent}/delete`, {})).status).toBe(204);
      expect((await api('board', `events/${ids.orchestraEvent}/details`)).status).toBe(404);
      expect(names((await api('board', 'event-list')).body.items)).not.toContain('Frühjahrskonzert');
    });
  });
});
