import { CSRF_HEADER, myFolderScoresResponseSchema, type MemberScoreRow } from '@vm-web/shared';
import { todayIn } from '../common/time/today';
import { addDays, LibraryBuilder } from '../testing/library-builder';
import { createTestApp, type TestApp } from '../testing/test-app';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { MeController } from './me.controller';
import { MeRepository } from './me.repository';
import { MeService } from './me.service';
import { PersonalTagsService } from './personal-tags.service';

/**
 * Mein Bereich against a real PostgreSQL (TEST_DATABASE_URL), see apps/api/README.md.
 *
 * Tree: root ─┬─ orchestra ── windClass
 *             ├─ youth
 *             └─ oldBand (archived)
 */
describe.skipIf(!TEST_DATABASE_URL)('Mein Bereich (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let t: TestApp;
  const today = todayIn('Europe/Berlin');
  const ids = {} as Record<string, string>;

  beforeAll(async () => {
    testDb = await createTestDatabase('me');
    const b = new LibraryBuilder(testDb.db);

    ids.root = await b.ensemble('Verein', null);
    ids.orchestra = await b.ensemble('Hauptorchester', ids.root);
    ids.windClass = await b.ensemble('Bläserklasse', ids.orchestra);
    ids.youth = await b.ensemble('Jugendorchester', ids.root);
    ids.oldBand = await b.ensemble('Alte Kapelle', ids.root, { archived: true });

    const musician = await b.role('Musiker:in', ['sheet.upload']);
    ids.anna = await b.user('Anna');
    ids.ben = await b.user('Ben');
    ids.rita = await b.user('Rita');
    ids.adam = await b.user('Adam', { isAdmin: true });
    ids.nobody = await b.user('Nobody');
    await b.member(ids.anna, ids.orchestra, musician);
    await b.member(ids.ben, ids.youth, musician);
    await b.member(ids.rita, ids.root, musician);

    const trumpet = await b.instrument('Trompete');
    const flugel = await b.instrument('Flügelhorn');
    const horn = await b.instrument('Horn');
    ids.tp1 = await b.voice(trumpet, 'Trompete 1 in B');
    ids.tp2 = await b.voice(trumpet, 'Trompete 2 in B');
    ids.flh1 = await b.voice(flugel, 'Flügelhorn 1 in B');
    ids.hnF = await b.voice(horn, 'Horn 1 in F');
    ids.hnEs = await b.voice(horn, 'Horn 1 in Es');
    await b.substitutes(ids.tp1, [ids.flh1]);
    await b.substitutes(ids.hnF, [ids.hnEs]);
    await b.profileVoices(ids.anna, [ids.tp1]);

    ids.march = await b.score('Alte Kameraden', 'Carl Teike');
    ids.polka = await b.score('Böhmischer Traum', 'Norbert Gälle');
    ids.hymn = await b.score('Highland Cathedral', 'Ulrich Roever');
    ids.secret = await b.score('Geheimstück');
    ids.windScore = await b.score('Erste Schritte');
    ids.youthScore = await b.score('Jugendmarsch');
    ids.archivedScore = await b.score('Vergessen');
    await b.sheet(ids.march, ids.tp1, 1);
    await b.sheet(ids.march, ids.flh1, 2);
    await b.sheet(ids.polka, ids.flh1, 2);
    await b.sheet(ids.hymn, ids.tp2, 3);
    await b.sheet(ids.windScore, ids.tp1, 1);

    ids.marschbuch = await b.folder(ids.orchestra, 'Marschbuch');
    await b.inFolder(ids.marschbuch, [
      [ids.march, '2'],
      [ids.polka, '10'],
      [ids.hymn, '1a'],
    ]);
    ids.hiddenFolder = await b.folder(ids.orchestra, 'Entwürfe', false);
    await b.inFolder(ids.hiddenFolder, [[ids.secret, '1']]);
    ids.windFolder = await b.folder(ids.windClass, 'Übungsheft');
    await b.inFolder(ids.windFolder, [[ids.windScore, '1']]);
    ids.youthFolder = await b.folder(ids.youth, 'Jugendmappe');
    await b.inFolder(ids.youthFolder, [[ids.youthScore, '1']]);
    ids.archivedFolder = await b.folder(ids.oldBand, 'Archiv');
    await b.inFolder(ids.archivedFolder, [[ids.archivedScore, '1']]);

    ids.concert = await b.event(ids.orchestra, 'Frühjahrskonzert', addDays(today, 7));
    await b.setlist(ids.concert, [ids.hymn, ids.march]);
    ids.todayEvent = await b.event(ids.orchestra, 'Probe heute', today);
    ids.eventOnly = await b.score('Nur im Event');
    await b.setlist(ids.todayEvent, [ids.eventOnly]);
    ids.pastEvent = await b.event(ids.orchestra, 'Herbstfest', addDays(today, -7));
    await b.setlist(ids.pastEvent, [ids.polka]);
    ids.hiddenEvent = await b.event(ids.orchestra, 'Interne Planung', addDays(today, 3), false);
    ids.youthEvent = await b.event(ids.youth, 'Jugendkonzert', addDays(today, 5));

    ids.marschTag = await b.clubTag('Marsch', [ids.march, ids.secret, ids.youthScore]);
    ids.emptyTag = await b.clubTag('Weihnachten');

    t = await createTestApp(
      { controllers: [MeController], providers: [MeRepository, MeService, PersonalTagsService] },
      { database: testDb.db, config: { APP_TIMEZONE: 'Europe/Berlin' } },
    );
  });

  afterAll(async () => {
    await t?.close();
    await testDb?.close();
  });

  type Who = 'anna' | 'ben' | 'rita' | 'adam' | 'nobody';
  const get = async (who: Who | null, path: string) => {
    const headers = who ? await t.loginAs({ userId: ids[who] }) : {};
    const res = await fetch(`${t.baseUrl}/me/${path}`, { headers });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, body: (await res.json()) as any };
  };
  const post = async (who: Who, path: string, body?: unknown, opts: { csrf?: boolean } = {}) => {
    const headers: Record<string, string> = { ...(await t.loginAs({ userId: ids[who] })), 'content-type': 'application/json' };
    if (opts.csrf === false) delete headers[CSRF_HEADER];
    const res = await fetch(`${t.baseUrl}/me/${path}`, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });
    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, body: (text ? JSON.parse(text) : undefined) as any };
  };
  const titles = (items: { title: string }[]) => items.map((i) => i.title);

  describe('access', () => {
    it.each(['voice-context', 'folders', 'upcoming-events', 'tags', 'profile', `folders/${'x'}/scores`])(
      'requires a session for %s (401)',
      async (path) => {
        expect((await get(null, path)).status).toBe(401);
      },
    );

    it('needs no permission – a member without any role permission is enough (R-2)', async () => {
      // ben's role only has sheet.upload; mein bereich does not need it
      expect((await get('ben', 'folders')).body.items.map((f: { name: string }) => f.name)).toEqual(['Jugendmappe']);
    });

    it('shows released folders of own ensembles and sub-ensembles only (R-2, H-1, N-15)', async () => {
      const folders = (await get('anna', 'folders')).body.items.map((f: { name: string; ensemble: { name: string } }) => [
        f.ensemble.name,
        f.name,
      ]);
      expect(folders).toEqual([
        ['Bläserklasse', 'Übungsheft'],
        ['Hauptorchester', 'Marschbuch'],
      ]);
    });

    it('lets a root member see every released, non-archived folder (H-1)', async () => {
      const names = (await get('rita', 'folders')).body.items.map((f: { name: string }) => f.name);
      expect(names.sort()).toEqual(['Jugendmappe', 'Marschbuch', 'Übungsheft']);
    });

    it('shows nothing to accounts without membership – also not to the admin flag alone', async () => {
      for (const who of ['nobody', 'adam'] as const) {
        expect((await get(who, 'folders')).body).toEqual({ items: [], nextCursor: null });
        expect((await get(who, 'upcoming-events')).body.items).toEqual([]);
        expect((await get(who, `folders/${ids.marschbuch}/overview`)).status).toBe(404);
      }
    });

    it.each([
      ['wrong ensemble', () => ids.youthFolder],
      ['not released', () => ids.hiddenFolder],
      ['archived ensemble', () => ids.archivedFolder],
      ['unknown', () => '0193f2a4-5b6c-7d8e-9f01-23456789abcd'],
    ])('answers 404 for a folder of a %s', async (_, id) => {
      expect((await get('anna', `folders/${id()}/overview`)).status).toBe(404);
      expect((await get('anna', `folders/${id()}/scores`)).status).toBe(404);
    });

    it('validates path ids (400)', async () => {
      expect((await get('anna', 'folders/not-a-uuid/overview')).body).toMatchObject({
        code: 'validation-failed',
        errors: [{ path: '/params/folderId', code: 'invalid_format' }],
      });
    });
  });

  describe('voices (M-1, M-2, M-3)', () => {
    it('reports profile voices and substitutes', async () => {
      expect((await get('anna', 'voice-context')).body).toEqual({
        profileVoices: [{ id: ids.tp1, name: 'Trompete 1 in B', instrumentId: expect.any(String) }],
        activeVoices: [{ id: ids.tp1, name: 'Trompete 1 in B', instrumentId: expect.any(String) }],
        isOverride: false,
        substituteVoices: [{ id: ids.flh1, name: 'Flügelhorn 1 in B', instrumentId: expect.any(String) }],
        needsVoiceSelection: false,
      });
    });

    it('asks for voices on the first visit (M-1)', async () => {
      expect((await get('ben', 'voice-context')).body).toMatchObject({ needsVoiceSelection: true, activeVoices: [] });
    });

    it('switches voices temporarily without changing the profile (M-2)', async () => {
      const body = (await get('anna', `voice-context?voiceId=${ids.tp2}`)).body;
      expect(body.isOverride).toBe(true);
      expect(body.activeVoices.map((v: { id: string }) => v.id)).toEqual([ids.tp2]);
      expect(body.profileVoices.map((v: { id: string }) => v.id)).toEqual([ids.tp1]);
    });

    it('rejects unknown voices in the switch', async () => {
      const res = await get('anna', `voice-context?voiceId=${ids.tp2}&voiceId=0193f2a4-5b6c-7d8e-9f01-23456789abcd`);
      expect(res).toMatchObject({ status: 400, body: { errors: [{ path: '/query/voiceId/1', code: 'unknown_voice' }] } });
    });

    it('lists all voices grouped by instrument in manual order (N-6)', async () => {
      const groups = (await get('ben', 'voice-options')).body.groups;
      expect(groups.map((g: { instrument: { name: string }; voices: { name: string }[] }) => [g.instrument.name, g.voices.map((v) => v.name)])).toEqual([
        ['Trompete', ['Trompete 1 in B', 'Trompete 2 in B']],
        ['Flügelhorn', ['Flügelhorn 1 in B']],
        ['Horn', ['Horn 1 in F', 'Horn 1 in Es']],
      ]);
    });
  });

  describe('folders (M-4)', () => {
    it('lists scores in natural number order with own sheets, substitutes and „Stimme fehlt“', async () => {
      const body = myFolderScoresResponseSchema.parse((await get('anna', `folders/${ids.marschbuch}/scores`)).body);
      expect(body.items.map((r: MemberScoreRow) => [r.number, r.title, r.availability, r.sheets.map((s) => `${s.kind}:${s.voice.name}`)])).toEqual([
        ['1a', 'Highland Cathedral', 'missing', []],
        ['2', 'Alte Kameraden', 'available', ['own:Trompete 1 in B', 'substitute:Flügelhorn 1 in B']],
        ['10', 'Böhmischer Traum', 'substitute-only', ['substitute:Flügelhorn 1 in B']],
      ]);
      expect(body.nextCursor).toBeNull();
    });

    it('filters to the switched voice (M-2)', async () => {
      const body = (await get('anna', `folders/${ids.marschbuch}/scores?voiceId=${ids.tp2}`)).body;
      expect(body.items.map((r: MemberScoreRow) => [r.title, r.availability])).toEqual([
        ['Highland Cathedral', 'available'],
        ['Alte Kameraden', 'missing'],
        ['Böhmischer Traum', 'missing'],
      ]);
    });

    it('pages with a cursor', async () => {
      const first = (await get('anna', `folders/${ids.marschbuch}/scores?limit=2`)).body;
      expect(titles(first.items)).toEqual(['Highland Cathedral', 'Alte Kameraden']);
      const second = (await get('anna', `folders/${ids.marschbuch}/scores?limit=2&cursor=${first.nextCursor}`)).body;
      expect(titles(second.items)).toEqual(['Böhmischer Traum']);
      expect(second.nextCursor).toBeNull();
    });

    it('searches title and composer and filters by club tag (M-4, M-8)', async () => {
      expect(titles((await get('anna', `folders/${ids.marschbuch}/scores?q=GÄLLE`)).body.items)).toEqual(['Böhmischer Traum']);
      expect(titles((await get('anna', `folders/${ids.marschbuch}/scores?q=kamer`)).body.items)).toEqual(['Alte Kameraden']);
      expect(titles((await get('anna', `folders/${ids.marschbuch}/scores?q=%25`)).body.items)).toEqual([]);
      expect(titles((await get('anna', `folders/${ids.marschbuch}/scores?clubTagId=${ids.marschTag}`)).body.items)).toEqual([
        'Alte Kameraden',
      ]);
    });

    it('counts missing scores and printable pages (M-3, D-2)', async () => {
      expect((await get('anna', `folders/${ids.marschbuch}/overview`)).body).toEqual({
        id: ids.marschbuch,
        name: 'Marschbuch',
        ensemble: { id: ids.orchestra, name: 'Hauptorchester' },
        scoreCount: 3,
        missingCount: 1,
        // own tp1 (1) + polka via substitute (2); hymn has nothing
        totalPages: 3,
      });
    });

    it('rejects invalid cursors', async () => {
      expect((await get('anna', `folders/${ids.marschbuch}/scores?cursor=garbage`)).body).toMatchObject({
        errors: [{ path: '/query/cursor', code: 'invalid_cursor' }],
      });
    });
  });

  describe('events (M-5)', () => {
    it('lists upcoming events from today on, ascending', async () => {
      const body = (await get('anna', 'upcoming-events')).body;
      expect(body.items.map((e: { name: string }) => e.name)).toEqual(['Probe heute', 'Frühjahrskonzert']);
      expect(body.items[1]).toMatchObject({ date: addDays(today, 7), scoreCount: 2, ensemble: { name: 'Hauptorchester' } });
    });

    it('moves past events into the archive, newest first', async () => {
      expect((await get('anna', 'archived-events')).body.items.map((e: { name: string }) => e.name)).toEqual(['Herbstfest']);
    });

    it('pages upcoming events', async () => {
      const first = (await get('anna', 'upcoming-events?limit=1')).body;
      const second = (await get('anna', `upcoming-events?limit=1&cursor=${first.nextCursor}`)).body;
      expect([...first.items, ...second.items].map((e: { name: string }) => e.name)).toEqual(['Probe heute', 'Frühjahrskonzert']);
      expect(second.nextCursor).toBeNull();
    });

    it('shows the setlist in playing order', async () => {
      const body = (await get('anna', `events/${ids.concert}/setlist`)).body;
      expect(body.items.map((r: MemberScoreRow & { position: number }) => [r.position, r.title, r.number])).toEqual([
        [1, 'Highland Cathedral', null],
        [2, 'Alte Kameraden', null],
      ]);
    });

    it('marks past events and counts like folders', async () => {
      expect((await get('anna', `events/${ids.pastEvent}/overview`)).body).toMatchObject({
        isPast: true,
        scoreCount: 1,
        missingCount: 0,
        totalPages: 2,
      });
      expect((await get('anna', `events/${ids.concert}/overview`)).body).toMatchObject({ isPast: false, missingCount: 1 });
    });

    it.each([
      ['hidden', () => ids.hiddenEvent],
      ['wrong ensemble', () => ids.youthEvent],
    ])('answers 404 for a %s event', async (_, id) => {
      expect((await get('anna', `events/${id()}/overview`)).status).toBe(404);
      expect((await get('anna', `events/${id()}/setlist`)).status).toBe(404);
    });
  });

  describe('scores (M-3, M-9)', () => {
    it('shows sheets, missing voices and tags of a visible score', async () => {
      expect((await get('anna', `scores/${ids.polka}/overview`)).body).toMatchObject({
        title: 'Böhmischer Traum',
        availability: 'substitute-only',
        missingVoices: [{ id: ids.tp1, name: 'Trompete 1 in B' }],
        sheets: [{ kind: 'substitute', voice: { id: ids.flh1 }, substituteFor: { id: ids.tp1 } }],
        clubTags: [],
        personalTags: [],
      });
    });

    it('makes scores visible through released events too', async () => {
      // this score is in no folder, only in the setlist of a released event
      expect((await get('anna', `scores/${ids.eventOnly}/overview`)).body).toMatchObject({ title: 'Nur im Event', availability: 'missing' });
      expect((await get('ben', `scores/${ids.eventOnly}/overview`)).status).toBe(404);
    });

    it.each([
      ['only in a hidden folder', () => ids.secret],
      ['of another ensemble', () => ids.youthScore],
      ['of an archived ensemble', () => ids.archivedScore],
    ])('answers 404 for a score %s', async (_, id) => {
      expect((await get('anna', `scores/${id()}/overview`)).status).toBe(404);
    });

    it('shows the youth score to youth members', async () => {
      expect((await get('ben', `scores/${ids.youthScore}/overview`)).status).toBe(200);
    });
  });

  describe('club tags (M-8, F-6)', () => {
    it('lists club tags with the number of visible scores', async () => {
      const body = (await get('anna', 'tags')).body;
      expect(body.clubTags).toEqual([
        { id: ids.marschTag, name: 'Marsch', scoreCount: 1 },
        { id: ids.emptyTag, name: 'Weihnachten', scoreCount: 0 },
      ]);
    });

    it('filters only visible scores – tags do not reveal hidden ones (F-6)', async () => {
      expect(titles((await get('anna', `club-tags/${ids.marschTag}/scores`)).body.items)).toEqual(['Alte Kameraden']);
      expect(titles((await get('rita', `club-tags/${ids.marschTag}/scores`)).body.items)).toEqual(['Alte Kameraden', 'Jugendmarsch']);
    });

    it('answers 404 for unknown tags', async () => {
      expect((await get('anna', `club-tags/${ids.march}/scores`)).status).toBe(404);
    });
  });

  describe('profile (M-1)', () => {
    it('returns profile data, voices and memberships', async () => {
      expect((await get('anna', 'profile')).body).toEqual({
        id: ids.anna,
        name: 'Anna',
        email: 'anna@example.org',
        pictureUrl: null,
        voices: [{ id: ids.tp1, name: 'Trompete 1 in B', instrumentId: expect.any(String) }],
        memberships: [{ ensemble: { id: ids.orchestra, name: 'Hauptorchester' }, role: { id: expect.any(String), name: 'Musiker:in' } }],
        isAdmin: false,
      });
    });

    it('sets profile voices in the given order', async () => {
      expect((await post('ben', 'profile/set-voices', { voiceIds: [ids.hnF, ids.tp2, ids.hnF] })).status).toBe(204);
      const body = (await get('ben', 'profile')).body;
      expect(body.voices.map((v: { id: string }) => v.id)).toEqual([ids.hnF, ids.tp2]);
      expect((await get('ben', 'voice-context')).body.substituteVoices.map((v: { id: string }) => v.id)).toEqual([ids.hnEs]);
    });

    it('rejects unknown voices, empty lists and missing CSRF tokens', async () => {
      expect((await post('ben', 'profile/set-voices', { voiceIds: ['0193f2a4-5b6c-7d8e-9f01-23456789abcd'] })).body).toMatchObject({
        errors: [{ path: '/body/voiceIds/0', code: 'unknown_voice' }],
      });
      expect((await post('ben', 'profile/set-voices', { voiceIds: [] })).status).toBe(400);
      expect((await post('ben', 'profile/set-voices', { voiceIds: [ids.tp1] }, { csrf: false })).status).toBe(403);
    });
  });

  describe('personal tags (M-8)', () => {
    it('creates, renames, assigns, filters and deletes own tags', async () => {
      const created = await post('anna', 'personal-tags/create', { name: 'Üben' });
      expect(created.status).toBe(201);
      const tagId = created.body.id as string;

      expect((await post('anna', 'personal-tags/create', { name: 'üben' })).body).toMatchObject({ code: 'name-taken' });
      expect((await post('anna', `personal-tags/${tagId}/rename`, { name: 'Auswendig' })).status).toBe(204);

      expect((await post('anna', `scores/${ids.march}/add-personal-tag`, { tagId })).status).toBe(204);
      expect((await post('anna', `scores/${ids.march}/add-personal-tag`, { tagId })).status).toBe(204); // idempotent
      expect((await get('anna', 'tags')).body.personalTags).toEqual([{ id: tagId, name: 'Auswendig', scoreCount: 1 }]);
      expect(titles((await get('anna', `personal-tags/${tagId}/scores`)).body.items)).toEqual(['Alte Kameraden']);
      expect(titles((await get('anna', `folders/${ids.marschbuch}/scores?personalTagId=${tagId}`)).body.items)).toEqual([
        'Alte Kameraden',
      ]);
      expect((await get('anna', `scores/${ids.march}/overview`)).body.personalTags).toEqual([{ id: tagId, name: 'Auswendig' }]);

      expect((await post('anna', `scores/${ids.march}/remove-personal-tag`, { tagId })).status).toBe(204);
      expect((await get('anna', 'tags')).body.personalTags[0].scoreCount).toBe(0);
      expect((await post('anna', `personal-tags/${tagId}/delete`)).status).toBe(204);
      expect((await get('anna', 'tags')).body.personalTags).toEqual([]);
    });

    it('keeps tags private: others neither see nor change them (404)', async () => {
      const tagId = (await post('anna', 'personal-tags/create', { name: 'Privat' })).body.id as string;
      expect((await get('rita', 'tags')).body.personalTags).toEqual([]);
      expect((await get('rita', `personal-tags/${tagId}/scores`)).status).toBe(404);
      expect((await post('rita', `personal-tags/${tagId}/rename`, { name: 'x' })).status).toBe(404);
      expect((await post('rita', `scores/${ids.march}/add-personal-tag`, { tagId })).status).toBe(404);
      expect((await post('rita', `personal-tags/${tagId}/delete`)).status).toBe(404);
    });

    it('allows the same name for different people', async () => {
      expect((await post('ben', 'personal-tags/create', { name: 'Privat' })).status).toBe(201);
    });

    it('only tags visible scores', async () => {
      const tagId = (await post('anna', 'personal-tags/create', { name: 'Versuch' })).body.id as string;
      expect((await post('anna', `scores/${ids.secret}/add-personal-tag`, { tagId })).status).toBe(404);
    });
  });
});
