import { eq } from 'drizzle-orm';
import { instruments, uploads, voices } from '../db/schema';
import { uuidv7 } from '../common/ids/uuid-v7';
import { LibraryBuilder } from '../testing/library-builder';
import { createTestApp, type TestApp } from '../testing/test-app';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { VoicesController } from './voices.controller';
import { VoicesRepository } from './voices.repository';
import { VoicesService } from './voices.service';

describe.skipIf(!TEST_DATABASE_URL)('Stimmen und Instrumente (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let t: TestApp;
  let b: LibraryBuilder;
  const ids = {} as Record<string, string>;
  const unknownId = '00000000-0000-7000-8000-00000000dead';

  beforeAll(async () => {
    testDb = await createTestDatabase('voices');
    b = new LibraryBuilder(testDb.db);

    ids.root = await b.ensemble('Verein', null);
    ids.orchestra = await b.ensemble('Hauptorchester', ids.root);
    const roles = {
      viewer: await b.role('Stimmen ansehen', ['voice.view']),
      creator: await b.role('Stimmen anlegen', ['voice.view', 'voice.create']),
      editor: await b.role('Stimmen bearbeiten', ['voice.view', 'voice.edit']),
      deleter: await b.role('Stimmen löschen', ['voice.view', 'voice.delete']),
      plain: await b.role('Ohne Rechte', []),
    };
    for (const name of Object.keys(roles) as (keyof typeof roles)[]) {
      ids[name] = await b.user(name);
      await b.member(ids[name], ids.orchestra, roles[name]);
    }

    ids.trumpet = await b.instrument('Trompete');
    ids.tp1 = await b.voice(ids.trumpet, 'Trompete 1 in B');
    ids.tp2 = await b.voice(ids.trumpet, 'Trompete 2 in B');
    ids.tp3 = await b.voice(ids.trumpet, 'Trompete 3 in B');
    ids.clarinet = await b.instrument('Klarinette');
    ids.cl1 = await b.voice(ids.clarinet, 'Klarinette 1 in B');
    ids.tuba = await b.instrument('Tuba');
    ids.tuba1 = await b.voice(ids.tuba, 'Tuba in C');
    await b.substitutes(ids.tp1, [ids.tp2]);
    await b.sheet(await b.score('Alte Kameraden'), ids.tp1);
    await b.lineup(ids.orchestra, [ids.tp1, ids.tp2]);

    t = await createTestApp({ controllers: [VoicesController], providers: [VoicesRepository, VoicesService] }, { database: testDb.db });
  });

  afterAll(async () => {
    await t?.close();
    await testDb?.close();
  });

  type Who = 'viewer' | 'creator' | 'editor' | 'deleter' | 'plain';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Res = { status: number; body: any };
  const json = async (res: Response): Promise<Res> => {
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  };
  const get = async (who: Who | null, path: string) =>
    json(await fetch(`${t.baseUrl}/voices/${path}`, { headers: who ? await t.loginAs({ userId: ids[who] }) : {} }));
  const post = async (who: Who, path: string, body: unknown = {}) =>
    json(
      await fetch(`${t.baseUrl}/voices/${path}`, {
        method: 'POST',
        headers: { ...(await t.loginAs({ userId: ids[who] })), 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  const voiceList = async () => (await get('viewer', 'voice-list')).body.groups as { instrument: { id: string; name: string; voiceCount: number }; voices: { id: string; name: string; substitutes: { id: string }[]; sheetCount: number; lineupCount: number }[] }[];
  const voiceRow = async (id: string) => (await testDb.db.select().from(voices).where(eq(voices.id, id)))[0];

  describe('Rechte (R-4)', () => {
    it('erlaubt jeden Endpunkt nur mit seinem Recht', async () => {
      const results = await Promise.all([
        get(null, 'voice-list'),
        get('plain', 'voice-list'),
        get('viewer', 'voice-list'),
        get('viewer', 'instrument-suggestions?q=T'),
        get('creator', 'instrument-suggestions?q=T'),
        get('editor', 'instrument-suggestions?q=T'),
        post('editor', 'voices/create', { instrumentName: 'Horn', name: 'Horn 1 in F' }),
        post('creator', `voices/${ids.tuba1}/update-details`, { instrumentName: 'Tuba', name: 'Tuba' }),
        post('creator', `voices/${ids.tuba1}/set-substitutes`, { substituteVoiceIds: [] }),
        post('editor', `voices/${ids.tuba1}/delete`),
        post('deleter', `instruments/${ids.tuba}/rename`, { name: 'Bass' }),
        post('deleter', 'instruments/reorder', { instrumentIds: [ids.trumpet] }),
        post('deleter', `instruments/${ids.tuba}/reorder-voices`, { voiceIds: [ids.tuba1] }),
      ]);
      expect(results.map((r) => r.status)).toEqual([401, 403, 200, 403, 200, 200, 403, 403, 403, 403, 403, 403, 403]);
      expect(results[1].body.code).toBe('forbidden');
    });
  });

  describe('Liste (N-6, N-9, F-16)', () => {
    it('gruppiert nach Instrument mit Ersatzstimmen und Verwendung', async () => {
      const groups = await voiceList();
      expect(groups.map((g) => [g.instrument.name, g.instrument.voiceCount])).toEqual([
        ['Trompete', 3],
        ['Klarinette', 1],
        ['Tuba', 1],
      ]);
      const tp1 = groups[0].voices[0];
      expect(tp1).toMatchObject({ id: ids.tp1, name: 'Trompete 1 in B', sheetCount: 1, lineupCount: 1 });
      expect(tp1.substitutes).toEqual([{ id: ids.tp2, name: 'Trompete 2 in B', instrumentId: ids.trumpet }]);
      expect(groups[0].voices[2]).toMatchObject({ id: ids.tp3, sheetCount: 0, lineupCount: 0, substitutes: [] });
    });

    it('schlägt Instrumente vor, Präfixtreffer zuerst (N-7)', async () => {
      const res = await get('creator', 'instrument-suggestions?q=t');
      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(['Trompete', 'Tuba', 'Klarinette']);
      expect((await get('creator', 'instrument-suggestions?q=xyz')).body.items).toEqual([]);
    });
  });

  describe('Anlegen und Bearbeiten (N-6, N-7)', () => {
    it('legt eine Stimme an und das Instrument dazu, wenn es fehlt', async () => {
      const horn = await post('creator', 'voices/create', { instrumentName: 'Horn', name: 'Horn 1 in F' });
      expect(horn.status).toBe(201);
      expect(horn.body.instrumentCreated).toBe(true);

      const horn2 = await post('creator', 'voices/create', { instrumentName: 'horn', name: 'Horn 2 in F' });
      expect(horn2.body).toEqual({ id: expect.any(String), instrumentId: horn.body.instrumentId, instrumentCreated: false });

      const groups = await voiceList();
      expect(groups.at(-1)?.instrument).toEqual({ id: horn.body.instrumentId, name: 'Horn', voiceCount: 2 });
      expect(groups.at(-1)?.voices.map((v) => v.name)).toEqual(['Horn 1 in F', 'Horn 2 in F']);
    });

    it('lehnt einen vergebenen Namen ab, ohne Groß-/Kleinschreibung', async () => {
      const res = await post('creator', 'voices/create', { instrumentName: 'Posaune', name: 'trompete 1 in b' });
      expect(res).toMatchObject({ status: 409, body: { code: 'name-taken' } });
      expect(await testDb.db.select().from(instruments).where(eq(instruments.name, 'Posaune'))).toEqual([]);
    });

    it('validiert den Körper', async () => {
      expect((await post('creator', 'voices/create', { instrumentName: 'Horn' })).status).toBe(400);
    });

    it('legt gleichzeitig mehrere Stimmen eines neuen Instruments an', async () => {
      const results = await Promise.all(
        ['Euphonium 1', 'Euphonium 2', 'Euphonium 3', 'Euphonium 4'].map((name) => post('creator', 'voices/create', { instrumentName: 'Euphonium', name })),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201]);
      expect(new Set(results.map((r) => r.body.instrumentId)).size).toBe(1);
      expect(results.filter((r) => r.body.instrumentCreated)).toHaveLength(1);
      const euphonium = (await voiceList()).find((g) => g.instrument.name === 'Euphonium');
      expect(euphonium?.instrument.voiceCount).toBe(4);
    });

    it('benennt um und verschiebt ans Ende eines anderen Instruments; leere Instrumente verschwinden', async () => {
      const created = await post('creator', 'voices/create', { instrumentName: 'Flügelhorn', name: 'Flügelhorn' });
      const moved = await post('editor', `voices/${created.body.id}/update-details`, { instrumentName: 'Trompete', name: 'Flügelhorn in B' });
      expect(moved.status).toBe(204);
      const groups = await voiceList();
      expect(groups.some((g) => g.instrument.name === 'Flügelhorn')).toBe(false);
      expect(groups.find((g) => g.instrument.id === ids.trumpet)?.voices.at(-1)?.name).toBe('Flügelhorn in B');

      const renamed = await post('editor', `voices/${ids.tp3}/update-details`, { instrumentName: 'Trompete', name: 'Trompete 3 in Es' });
      expect(renamed.status).toBe(204);
      expect(await voiceRow(ids.tp3)).toMatchObject({ name: 'Trompete 3 in Es', instrumentId: ids.trumpet });
    });

    it('meldet unbekannte Stimmen und vergebene Namen beim Bearbeiten', async () => {
      expect((await post('editor', `voices/${unknownId}/update-details`, { instrumentName: 'Tuba', name: 'Neu' })).status).toBe(404);
      const taken = await post('editor', `voices/${ids.tp3}/update-details`, { instrumentName: 'Trompete', name: 'Trompete 2 in B' });
      expect(taken).toMatchObject({ status: 409, body: { code: 'name-taken' } });
    });
  });

  describe('Ersatzstimmen (N-9)', () => {
    it('speichert die Reihenfolge', async () => {
      expect((await post('editor', `voices/${ids.tp2}/set-substitutes`, { substituteVoiceIds: [ids.tp3, ids.tp1] })).status).toBe(204);
      const tp2 = (await voiceList())[0].voices.find((v) => v.id === ids.tp2);
      expect(tp2?.substitutes.map((s) => s.id)).toEqual([ids.tp3, ids.tp1]);
      expect((await post('editor', `voices/${ids.tp2}/set-substitutes`, { substituteVoiceIds: [] })).status).toBe(204);
    });

    it('lehnt sich selbst, Doppelte und Unbekannte ab', async () => {
      const self = await post('editor', `voices/${ids.tp2}/set-substitutes`, { substituteVoiceIds: [ids.tp2, ids.tp1, ids.tp1] });
      expect(self.status).toBe(400);
      expect(self.body.errors).toEqual([
        { path: '/body/substituteVoiceIds/0', code: 'self_reference' },
        { path: '/body/substituteVoiceIds/2', code: 'duplicate' },
      ]);
      const unknown = await post('editor', `voices/${ids.tp2}/set-substitutes`, { substituteVoiceIds: [unknownId] });
      expect(unknown.status).toBe(400);
      expect(unknown.body.errors).toEqual([expect.objectContaining({ path: '/body/substituteVoiceIds/0' })]);
      expect((await post('editor', `voices/${unknownId}/set-substitutes`, { substituteVoiceIds: [] })).status).toBe(404);
    });
  });

  describe('Löschen', () => {
    it('löscht nur unbenutzte Stimmen', async () => {
      expect(await post('deleter', `voices/${ids.tp1}/delete`)).toMatchObject({ status: 409, body: { code: 'in-use' } });
      expect(await post('deleter', `voices/${ids.tp2}/delete`)).toMatchObject({ status: 409, body: { code: 'in-use' } });

      const profile = await post('creator', 'voices/create', { instrumentName: 'Trompete', name: 'Trompete Profil' });
      await b.profileVoices(ids.viewer, [profile.body.id]);
      expect((await post('deleter', `voices/${profile.body.id}/delete`)).status).toBe(409);

      const pending = await post('creator', 'voices/create', { instrumentName: 'Trompete', name: 'Trompete Upload' });
      await testDb.db.insert(uploads).values({
        id: uuidv7(),
        uploadedBy: ids.viewer,
        fileName: 'a.pdf',
        fileKey: `uploads/${uuidv7()}.pdf`,
        pageCount: 1,
        sizeBytes: 100,
        voiceId: pending.body.id,
        status: 'pending',
      });
      expect((await post('deleter', `voices/${pending.body.id}/delete`)).status).toBe(409);
    });

    it('löscht eine unbenutzte Stimme und ihr leeres Instrument', async () => {
      expect((await post('deleter', `voices/${ids.cl1}/delete`)).status).toBe(204);
      expect(await voiceRow(ids.cl1)).toBeUndefined();
      expect(await testDb.db.select().from(instruments).where(eq(instruments.id, ids.clarinet))).toEqual([]);
      expect((await post('deleter', `voices/${ids.cl1}/delete`)).status).toBe(404);
    });
  });

  describe('Instrumente (N-7, F-16)', () => {
    it('benennt um, ohne Namen doppelt zu vergeben', async () => {
      expect((await post('editor', `instruments/${ids.tuba}/rename`, { name: 'Bass' })).status).toBe(204);
      expect(await post('editor', `instruments/${ids.tuba}/rename`, { name: 'trompete' })).toMatchObject({ status: 409, body: { code: 'name-taken' } });
      expect((await post('editor', `instruments/${unknownId}/rename`, { name: 'Neu' })).status).toBe(404);
    });

    it('sortiert Instrumente nur mit vollständiger Liste', async () => {
      const current = (await voiceList()).map((g) => g.instrument.id);
      const reversed = [...current].reverse();
      expect((await post('editor', 'instruments/reorder', { instrumentIds: reversed })).status).toBe(204);
      expect((await voiceList()).map((g) => g.instrument.id)).toEqual(reversed);
      expect(await post('editor', 'instruments/reorder', { instrumentIds: reversed.slice(1) })).toMatchObject({ status: 409, body: { code: 'conflict' } });
    });

    it('sortiert Stimmen eines Instruments nur mit vollständiger Liste', async () => {
      const trumpet = (await voiceList()).find((g) => g.instrument.id === ids.trumpet);
      const reversed = (trumpet?.voices ?? []).map((v) => v.id).reverse();
      expect((await post('editor', `instruments/${ids.trumpet}/reorder-voices`, { voiceIds: reversed })).status).toBe(204);
      expect((await voiceList()).find((g) => g.instrument.id === ids.trumpet)?.voices.map((v) => v.id)).toEqual(reversed);
      expect(await post('editor', `instruments/${ids.trumpet}/reorder-voices`, { voiceIds: [ids.tuba1] })).toMatchObject({ status: 409, body: { code: 'conflict' } });
      expect((await post('editor', `instruments/${unknownId}/reorder-voices`, { voiceIds: [ids.tuba1] })).status).toBe(404);
    });
  });
});
