import { CSRF_HEADER } from '@vm-web/shared';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { todayIn } from '../common/time/today';
import { EventsController } from '../events/events.controller';
import { EventsService } from '../events/events.service';
import { FoldersController } from '../folders/folders.controller';
import { FoldersService } from '../folders/folders.service';
import { MeRepository } from '../me/me.repository';
import { FieldsService } from '../scores/fields.service';
import { ScoreImportService } from '../scores/score-import.service';
import { ScoresController } from '../scores/scores.controller';
import { ScoresRepository } from '../scores/scores.repository';
import { ScoresService } from '../scores/scores.service';
import { expandPermissions } from '../seed/default-roles';
import { SeedService } from '../seed/seed.service';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import { FILE_STORAGE } from '../storage/file-storage';
import { FsFileStorage } from '../storage/fs-file-storage';
import { TagsController, TagsService } from '../tags/tags.module';
import { addDays, LibraryBuilder } from '../testing/library-builder';
import { createTestApp, type TestApp } from '../testing/test-app';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { VoicesController } from '../voices/voices.controller';
import { VoicesService } from '../voices/voices.service';

/**
 * Library management (slice 4) against a real PostgreSQL (TEST_DATABASE_URL).
 *
 * Tree: root ─┬─ orchestra ── windClass
 *             └─ youth
 */
describe.skipIf(!TEST_DATABASE_URL)('Notenverwaltung (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let t: TestApp;
  let storageDir: string;
  let storage: FsFileStorage;
  const ids = {} as Record<string, string>;
  const today = todayIn('Europe/Berlin');

  beforeAll(async () => {
    testDb = await createTestDatabase('library');
    storageDir = await mkdtemp(join(tmpdir(), 'vmweb-library-'));
    storage = new FsFileStorage(storageDir);
    await storage.init();
    const b = new LibraryBuilder(testDb.db);

    ids.root = await b.ensemble('Verein', null);
    ids.orchestra = await b.ensemble('Hauptorchester', ids.root);
    ids.windClass = await b.ensemble('Bläserklasse', ids.orchestra);
    ids.youth = await b.ensemble('Jugendorchester', ids.root);
    await b.settings(ids.orchestra);

    const roles = {
      librarian: await b.role('Notenwart:in', expandPermissions(['score.*', 'voice.*', 'folder.*', 'event.*', 'tag.*', 'sheet.approve', 'member.view'])),
      musician: await b.role('Musiker:in', ['sheet.upload']),
      board: await b.role('Vorstand', expandPermissions(['member.view', 'event.*'])),
      config: await b.role('Konfiguration', ['config.view', 'config.edit']),
      viewer: await b.role('Lesend', ['folder.view', 'score.view']),
    };
    for (const [name, ensemble, role] of [
      ['lib', ids.orchestra, roles.librarian],
      ['mus', ids.orchestra, roles.musician],
      ['board', ids.youth, roles.board],
      ['cfg', ids.youth, roles.config],
      ['viewer', ids.orchestra, roles.viewer],
    ] as const) {
      ids[name] = await b.user(name);
      await b.member(ids[name], ensemble, role);
    }
    ids.admin = await b.user('admin', { isAdmin: true });

    const trumpet = await b.instrument('Trompete');
    const horn = await b.instrument('Horn');
    ids.tp1 = await b.voice(trumpet, 'Trompete 1 in B');
    ids.tp2 = await b.voice(trumpet, 'Trompete 2 in B');
    ids.hnF = await b.voice(horn, 'Horn 1 in F');
    ids.hnEs = await b.voice(horn, 'Horn 1 in Es');
    await b.substitutes(ids.hnF, [ids.hnEs]);
    await b.lineup(ids.orchestra, [ids.tp1, ids.tp2, ids.hnF]);

    ids.youthFolder = await b.folder(ids.youth, 'Jugendmappe');
    ids.orchestraFolder = await b.folder(ids.orchestra, 'Marschbuch');

    t = await createTestApp(
      {
        controllers: [ScoresController, VoicesController, FoldersController, EventsController, TagsController],
        providers: [ScoresRepository, ScoresService, FieldsService, ScoreImportService, MeRepository, VoicesService, FoldersService, EventsService, TagsService, ClubSettingsRepository],
      },
      { database: testDb.db, providers: [{ provide: FILE_STORAGE, useValue: storage }], config: { APP_TIMEZONE: 'Europe/Berlin' } },
    );
  });

  afterAll(async () => {
    await t?.close();
    await testDb?.close();
    if (storageDir) await rm(storageDir, { recursive: true, force: true });
  });

  type Who = 'lib' | 'mus' | 'board' | 'cfg' | 'viewer' | 'admin';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = async (who: Who, path: string, body?: unknown): Promise<{ status: number; body: any; headers: Headers; text: string }> => {
    const headers: Record<string, string> = await t.loginAs({ userId: ids[who] });
    const init: RequestInit = { headers };
    if (body !== undefined) {
      init.method = 'POST';
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${t.baseUrl}/${path}`, init);
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    return { status: res.status, body: parsed, headers: res.headers, text };
  };
  const enc = (value: unknown) => encodeURIComponent(JSON.stringify(value));

  describe('permissions per area (R-3, R-4, F-3)', () => {
    // [who, path, body (POST) or undefined (GET), expected status]
    const matrix = (): Array<[Who, string, unknown, number]> => [
      // scores: any-ensemble
      ['lib', 'scores/score-table', undefined, 200],
      ['viewer', 'scores/score-table', undefined, 200],
      ['mus', 'scores/score-table', undefined, 403],
      ['board', 'scores/score-table', undefined, 403],
      ['admin', 'scores/score-table', undefined, 200],
      ['cfg', 'scores/field-definitions', undefined, 200],
      ['mus', 'scores/field-definitions', undefined, 403],
      ['viewer', 'scores/scores/create', { title: 'x', composer: null, arranger: null, publisher: null, publisherNumber: null, durationSeconds: null }, 403],
      ['viewer', 'scores/field-definitions/create', { name: 'x', type: 'text' }, 403],
      // voices: any-ensemble
      ['lib', 'voices/voice-list', undefined, 200],
      ['mus', 'voices/voice-list', undefined, 403],
      ['board', 'voices/voices/create', { instrumentName: 'Tuba', name: 'Tuba in C' }, 403],
      // folders: ensemble of the folder
      ['lib', `folders/folders/${ids.orchestraFolder}/details`, undefined, 200],
      ['viewer', `folders/folders/${ids.orchestraFolder}/details`, undefined, 200],
      ['viewer', `folders/folders/${ids.orchestraFolder}/rename`, { name: 'x' }, 403],
      ['lib', `folders/folders/${ids.youthFolder}/details`, undefined, 404],
      ['board', `folders/folders/${ids.youthFolder}/details`, undefined, 404],
      ['mus', `folders/folders/${ids.orchestraFolder}/details`, undefined, 404],
      ['admin', `folders/folders/${ids.youthFolder}/details`, undefined, 200],
      ['lib', 'folders/folders/create', { ensembleId: ids.youth, name: 'x' }, 404],
      ['mus', 'folders/ensemble-options', undefined, 403],
      ['board', 'folders/ensemble-options', undefined, 403],
      // events: ensemble of the event
      ['mus', 'events/ensemble-options', undefined, 403],
      ['board', 'events/events/create', { ensembleId: ids.orchestra, name: 'x', date: today }, 404],
      // tags: any-ensemble
      ['lib', 'tags/club-tag-list', undefined, 200],
      ['mus', 'tags/club-tag-list', undefined, 403],
      ['board', 'tags/club-tags/create', { name: 'x' }, 403],
    ];

    it('allows and forbids as expected', async () => {
      const failures: string[] = [];
      for (const [who, path, body, expected] of matrix()) {
        const res = await api(who, path, body);
        if (res.status !== expected) failures.push(`${who} ${body ? 'POST' : 'GET'} ${path}: ${res.status} (expected ${expected})`);
      }
      expect(failures).toEqual([]);
    });

    it('lists only ensembles where creating is allowed, incl. sub-ensembles (F-3)', async () => {
      // Tree order with depth (docs/api.md › Ensemble-Auswahl): the sub-ensemble follows its parent.
      expect((await api('lib', 'folders/ensemble-options')).body.items.map((e: { name: string; depth: number }) => [e.name, e.depth])).toEqual([
        ['Hauptorchester', 0],
        ['Bläserklasse', 1],
      ]);
      expect((await api('board', 'events/ensemble-options')).body.items.map((e: { name: string }) => e.name)).toEqual(['Jugendorchester']);
    });

    it('filters folder lists to ensembles with folder.view', async () => {
      const names = async (who: Who) => (await api(who, 'folders/folder-list')).body.items.map((f: { name: string }) => f.name);
      expect(await names('lib')).toEqual(['Marschbuch']);
      expect(await names('board')).toEqual([]);
      expect((await names('admin')).sort()).toEqual(['Jugendmappe', 'Marschbuch']);
    });
  });

  describe('custom fields (N-2, N-3, F-13)', () => {
    it('lets config.edit and score.edit manage fields; type of options is checked', async () => {
      expect((await api('cfg', 'scores/field-definitions/create', { name: 'Archivnummer', type: 'text' })).status).toBe(201);
      const level = await api('lib', 'scores/field-definitions/create', {
        name: 'Schwierigkeit',
        type: 'select',
        options: [{ label: 'leicht' }, { label: 'mittel' }, { label: 'schwer' }],
      });
      expect(level.status).toBe(201);
      ids.levelField = level.body.id;
      expect((await api('lib', 'scores/field-definitions/create', { name: 'archivnummer', type: 'number' })).body.code).toBe('name-taken');
      expect((await api('lib', 'scores/field-definitions/create', { name: 'X', type: 'text', options: [{ label: 'a' }] })).body.errors).toEqual([
        { path: '/body/options', code: 'options_not_allowed' },
      ]);
      expect((await api('lib', 'scores/field-definitions/create', { name: 'Y', type: 'select' })).status).toBe(400);

      const defs = (await api('lib', 'scores/field-definitions')).body.items;
      expect(defs.map((d: { name: string; position: number }) => [d.name, d.position])).toEqual([
        ['Archivnummer', 0],
        ['Schwierigkeit', 1],
      ]);
      ids.archiveField = defs[0].id;
      ids.optEasy = defs[1].options[0].id;
      ids.optHard = defs[1].options[2].id;
    });

    it('reorders fields only with the complete list', async () => {
      expect((await api('lib', 'scores/field-definitions/reorder', { fieldIds: [ids.levelField] })).body.code).toBe('conflict');
      expect((await api('lib', 'scores/field-definitions/reorder', { fieldIds: [ids.levelField, ids.archiveField] })).status).toBe(204);
      expect((await api('lib', 'scores/field-definitions')).body.items.map((d: { name: string }) => d.name)).toEqual(['Schwierigkeit', 'Archivnummer']);
    });
  });

  describe('scores (N-1, N-3, N-4)', () => {
    const fixed = { composer: null, arranger: null, publisher: null, publisherNumber: null, durationSeconds: null };

    it('creates scores with custom fields and tags; invalid values are 400 with pointer', async () => {
      ids.marchTag = (await api('lib', 'tags/club-tags/create', { name: 'Marsch' })).body.id;
      const bad = await api('lib', 'scores/scores/create', { ...fixed, title: 'Bad', customFields: { [ids.levelField]: ids.marchTag } });
      expect(bad.body.errors).toEqual([{ path: `/body/customFields/${ids.levelField}`, code: 'invalid_option' }]);
      expect((await api('lib', 'scores/scores/create', { ...fixed, title: 'Bad', tagIds: [ids.levelField] })).status).toBe(404);

      const create = async (title: string, extra: Record<string, unknown>) => {
        const res = await api('lib', 'scores/scores/create', { ...fixed, title, ...extra });
        expect(res.status).toBe(201);
        return res.body.id as string;
      };
      ids.march = await create('Alte Kameraden', {
        composer: 'Carl Teike',
        durationSeconds: 210,
        customFields: { [ids.levelField]: ids.optEasy, [ids.archiveField]: '=A-17' },
        tagIds: [ids.marchTag],
      });
      ids.polka = await create('Böhmischer Traum', { composer: 'Norbert Gälle', customFields: { [ids.levelField]: ids.optHard } });
      ids.hymn = await create('Highland Cathedral', { customFields: { [ids.archiveField]: 'Archiv B-2' } });

      expect((await api('lib', `scores/scores/${ids.march}/details`)).body).toMatchObject({
        title: 'Alte Kameraden',
        composer: 'Carl Teike',
        durationSeconds: 210,
        customFields: { [ids.levelField]: ids.optEasy, [ids.archiveField]: '=A-17' },
        tags: [{ id: ids.marchTag, name: 'Marsch' }],
      });
    });

    it('sorts by fixed and custom fields with empty values last, both directions', async () => {
      const titles = async (query: string) => (await api('lib', `scores/score-table?${query}`)).body.items.map((r: { title: string }) => r.title);
      expect(await titles('sort=composer&dir=asc')).toEqual(['Alte Kameraden', 'Böhmischer Traum', 'Highland Cathedral']);
      expect(await titles('sort=composer&dir=desc')).toEqual(['Böhmischer Traum', 'Alte Kameraden', 'Highland Cathedral']);
      expect(await titles(`sort=field:${ids.levelField}&dir=desc`)).toEqual(['Böhmischer Traum', 'Alte Kameraden', 'Highland Cathedral']);
    });

    it('pages with cursors for any sort order', async () => {
      const all: string[] = [];
      let cursor: string | null = null;
      do {
        const res: { body: { items: { title: string }[]; nextCursor: string | null; totalCount: number } } = await api(
          'lib',
          `scores/score-table?sort=durationSeconds&dir=desc&limit=1${cursor ? `&cursor=${cursor}` : ''}`,
        );
        expect(res.body.totalCount).toBe(3);
        all.push(...res.body.items.map((i) => i.title));
        cursor = res.body.nextCursor;
      } while (cursor);
      // empty durations last; among them the id decides in the same direction (newest first)
      expect(all).toEqual(['Alte Kameraden', 'Highland Cathedral', 'Böhmischer Traum']);
    });

    it('filters by fixed and custom fields, searches custom text and filters by club tag', async () => {
      const titles = async (query: string) => (await api('lib', `scores/score-table?${query}`)).body.items.map((r: { title: string }) => r.title);
      expect(await titles(`filter=${enc([{ column: `field:${ids.levelField}`, op: 'eq', value: ids.optHard }])}`)).toEqual(['Böhmischer Traum']);
      expect(await titles(`filter=${enc([{ column: 'durationSeconds', op: 'gt', value: 100 }])}`)).toEqual(['Alte Kameraden']);
      expect(await titles(`filter=${enc([{ column: 'composer', op: 'empty' }])}`)).toEqual(['Highland Cathedral']);
      expect(await titles('q=archiv%20b')).toEqual(['Highland Cathedral']);
      expect(await titles(`tagId=${ids.marchTag}`)).toEqual(['Alte Kameraden']);
    });

    it('rejects filters that do not fit the column', async () => {
      const res = await api('lib', `scores/score-table?filter=${enc([{ column: 'durationSeconds', op: 'contains', value: 'x' }, { column: 'field:00000000-0000-7000-8000-000000000000', op: 'empty' }])}`);
      expect(res.body.errors).toEqual([{ path: '/query/filter/0/op', code: 'unsupported_operator' }]);
      const unknown = await api('lib', `scores/score-table?filter=${enc([{ column: 'field:00000000-0000-7000-8000-000000000000', op: 'empty' }])}`);
      expect(unknown.body.errors).toEqual([{ path: '/query/filter/0/column', code: 'unknown_field' }]);
    });

    it('computes completeness against the lineup with substitutes counted separately (N-4, N-9, F-5)', async () => {
      const b = new LibraryBuilder(testDb.db);
      ids.sheetTp1 = await b.sheet(ids.march, ids.tp1, 2);
      await b.sheet(ids.march, ids.hnEs, 1);
      await storage.write(`sheets/${ids.sheetTp1}.pdf`, Buffer.from('%PDF-1.7 test'));

      const table = (await api('lib', `scores/score-table?sort=completeness&dir=desc`)).body;
      expect(table.completenessEnsemble).toEqual({ id: ids.orchestra, name: 'Hauptorchester' });
      expect(table.items[0]).toMatchObject({ title: 'Alte Kameraden', completeness: { present: 1, substituted: 1, total: 3 } });

      const detail = (await api('lib', `scores/scores/${ids.march}/completeness`)).body;
      expect(detail.voices.map((v: { voice: { name: string }; status: string; substitute: { name: string } | null }) => [v.voice.name, v.status, v.substitute?.name ?? null])).toEqual([
        ['Trompete 1 in B', 'present', null],
        ['Trompete 2 in B', 'missing', null],
        ['Horn 1 in F', 'substituted', 'Horn 1 in Es'],
      ]);
      expect((await api('lib', `scores/scores/${ids.march}/completeness?ensembleId=${ids.youth}`)).body.summary).toEqual({ present: 0, substituted: 0, total: 0 });
      expect((await api('lib', 'scores/ensemble-options')).body).toEqual({ items: [{ id: ids.orchestra, name: 'Hauptorchester', depth: 0 }], defaultEnsembleId: ids.orchestra });
    });

    it('exports the filtered table as CSV with BOM, custom fields and neutralized formulas (N-3, F-10)', async () => {
      const headers = await t.loginAs({ userId: ids.lib });
      const raw = await fetch(`${t.baseUrl}/scores/score-table/export?sort=title`, { headers });
      expect(raw.headers.get('content-type')).toBe('text/csv; charset=utf-8');
      expect(raw.headers.get('content-disposition')).toMatch(/^attachment; filename="stuecke-\d{4}-\d{2}-\d{2}\.csv"/);
      const bytes = Buffer.from(await raw.arrayBuffer());
      // UTF-8 BOM for Excel (fetch's text() would silently strip it)
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      const lines = bytes.subarray(3).toString('utf8').split('\r\n');
      expect(lines[0]).toBe('title;composer;arranger;publisher;publisherNumber;durationSeconds;Schwierigkeit;Archivnummer;tags;completeness');
      expect(lines[1]).toBe("Alte Kameraden;Carl Teike;;;;210;leicht;'=A-17;Marsch;1/3");
    });

    it('lists and streams sheets, then deletes a sheet with its file', async () => {
      const sheets = (await api('lib', `scores/scores/${ids.march}/sheets`)).body;
      expect(sheets.items.map((s: { voice: { name: string }; pageCount: number }) => [s.voice.name, s.pageCount])).toEqual([
        ['Trompete 1 in B', 2],
        ['Horn 1 in Es', 1],
      ]);
      const pdf = await api('viewer', `scores/sheets/${ids.sheetTp1}/pdf`);
      expect(pdf.status).toBe(200);
      expect(pdf.headers.get('content-type')).toBe('application/pdf');
      expect(pdf.headers.get('content-disposition')).toMatch(/^inline; filename="/);
      expect(pdf.headers.get('content-disposition')).toContain(`filename*=UTF-8''${encodeURIComponent('Alte Kameraden – Trompete 1 in B.pdf')}`);
      expect(pdf.text).toBe('%PDF-1.7 test');

      expect((await api('viewer', `scores/sheets/${ids.sheetTp1}/delete`, {})).status).toBe(403);
      expect((await api('lib', `scores/sheets/${ids.sheetTp1}/delete`, {})).status).toBe(204);
      expect(await storage.stat(`sheets/${ids.sheetTp1}.pdf`)).toBeNull();
      expect((await api('lib', `scores/sheets/${ids.sheetTp1}/pdf`)).status).toBe(404);
    });

    it('updates details and tags; removing an option removes its values (N-2)', async () => {
      expect(
        (
          await api('lib', `scores/scores/${ids.polka}/update-details`, {
            ...fixed,
            title: 'Böhmischer Traum',
            composer: 'Norbert Gälle',
            customFields: { [ids.levelField]: ids.optHard },
            tagIds: [ids.marchTag],
          })
        ).status,
      ).toBe(204);
      expect((await api('lib', `scores/scores/${ids.polka}/details`)).body.tags).toEqual([{ id: ids.marchTag, name: 'Marsch' }]);

      const defs = (await api('lib', 'scores/field-definitions')).body.items;
      const level = defs.find((d: { id: string }) => d.id === ids.levelField);
      const keep = level.options.filter((o: { id: string }) => o.id !== ids.optHard);
      expect((await api('lib', `scores/field-definitions/${ids.levelField}/update-definition`, { name: 'Schwierigkeit', required: false, options: keep })).status).toBe(204);
      expect((await api('lib', `scores/scores/${ids.polka}/details`)).body.customFields).toEqual({});
      expect((await api('lib', `scores/scores/${ids.march}/details`)).body.customFields[ids.levelField]).toBe(ids.optEasy);
    });

    it('deletes fields with their values and scores with their sheets', async () => {
      expect((await api('cfg', `scores/field-definitions/${ids.archiveField}/delete`, {})).status).toBe(204);
      expect((await api('lib', `scores/scores/${ids.hymn}/details`)).body.customFields).toEqual({});
      expect((await api('viewer', `scores/scores/${ids.hymn}/delete`, {})).status).toBe(403);
      expect((await api('lib', `scores/scores/${ids.hymn}/delete`, {})).status).toBe(204);
      expect((await api('lib', `scores/scores/${ids.hymn}/details`)).status).toBe(404);
    });
  });

  describe('voices and instruments (N-6, N-7, N-9, F-16)', () => {
    it('creates voices, instruments automatically and case-insensitively', async () => {
      const tuba = await api('lib', 'voices/voices/create', { instrumentName: 'Tuba', name: 'Tuba in C' });
      expect(tuba.body).toMatchObject({ instrumentCreated: true });
      const tp3 = await api('lib', 'voices/voices/create', { instrumentName: 'trompete', name: 'Trompete 3 in B' });
      expect(tp3.body).toMatchObject({ instrumentCreated: false });
      ids.tp3 = tp3.body.id;
      ids.tuba = tuba.body.id;
      ids.tubaInstrument = tuba.body.instrumentId;
      expect((await api('lib', 'voices/voices/create', { instrumentName: 'Tuba', name: 'tuba in c' })).body.code).toBe('name-taken');
      expect((await api('lib', 'voices/instrument-suggestions?q=t')).body.items.map((i: { name: string }) => i.name)).toEqual(['Trompete', 'Tuba']);
    });

    it('sets ordered substitutes and validates them', async () => {
      expect((await api('lib', `voices/voices/${ids.tp3}/set-substitutes`, { substituteVoiceIds: [ids.tp2, ids.tp1] })).status).toBe(204);
      expect((await api('lib', `voices/voices/${ids.tp3}/set-substitutes`, { substituteVoiceIds: [ids.tp3] })).body.errors).toEqual([
        { path: '/body/substituteVoiceIds/0', code: 'self_reference' },
      ]);
      const list = (await api('lib', 'voices/voice-list')).body.groups;
      const trumpet = list.find((g: { instrument: { name: string } }) => g.instrument.name === 'Trompete');
      expect(trumpet.instrument.voiceCount).toBe(3);
      expect(trumpet.voices.find((v: { id: string }) => v.id === ids.tp3).substitutes.map((s: { name: string }) => s.name)).toEqual([
        'Trompete 2 in B',
        'Trompete 1 in B',
      ]);
      expect(trumpet.voices.find((v: { id: string }) => v.id === ids.tp1)).toMatchObject({ lineupCount: 1 });
    });

    it('reorders instruments and voices only with complete lists', async () => {
      const groups = (await api('lib', 'voices/voice-list')).body.groups;
      const instrumentIds = groups.map((g: { instrument: { id: string } }) => g.instrument.id).reverse();
      expect((await api('lib', 'voices/instruments/reorder', { instrumentIds: instrumentIds.slice(1) })).body.code).toBe('conflict');
      expect((await api('lib', 'voices/instruments/reorder', { instrumentIds })).status).toBe(204);
      expect((await api('lib', 'voices/voice-list')).body.groups[0].instrument.name).toBe('Tuba');
      const trumpetId = groups.find((g: { instrument: { name: string } }) => g.instrument.name === 'Trompete').instrument.id;
      expect((await api('lib', `voices/instruments/${trumpetId}/reorder-voices`, { voiceIds: [ids.tp3, ids.tp2, ids.tp1] })).status).toBe(204);
      expect((await api('lib', 'voices/voice-list')).body.groups.find((g: { instrument: { id: string } }) => g.instrument.id === trumpetId).voices.map((v: { name: string }) => v.name)).toEqual([
        'Trompete 3 in B',
        'Trompete 2 in B',
        'Trompete 1 in B',
      ]);
    });

    it('renames instruments, refuses deleting used voices and removes empty instruments', async () => {
      expect((await api('lib', `voices/instruments/${ids.tubaInstrument}/rename`, { name: 'Horn' })).body.code).toBe('name-taken');
      expect((await api('lib', `voices/instruments/${ids.tubaInstrument}/rename`, { name: 'Bass' })).status).toBe(204);
      expect((await api('lib', `voices/voices/${ids.tp1}/delete`, {})).body.code).toBe('in-use'); // lineup
      expect((await api('lib', `voices/voices/${ids.tuba}/delete`, {})).status).toBe(204);
      expect((await api('lib', 'voices/voice-list')).body.groups.map((g: { instrument: { name: string } }) => g.instrument.name)).not.toContain('Bass');
    });

    it('moves a voice to another instrument by renaming the instrument field', async () => {
      expect((await api('lib', `voices/voices/${ids.tp3}/update-details`, { instrumentName: 'Kornett', name: 'Kornett 1 in B' })).status).toBe(204);
      const groups = (await api('lib', 'voices/voice-list')).body.groups;
      expect(groups.find((g: { instrument: { name: string } }) => g.instrument.name === 'Kornett').voices[0].name).toBe('Kornett 1 in B');
    });
  });

  describe('folders (N-5, N-15)', () => {
    it('creates folders per ensemble with unique names; archived ensembles are refused', async () => {
      const res = await api('lib', 'folders/folders/create', { ensembleId: ids.windClass, name: 'Übungsheft' });
      expect(res.status).toBe(201);
      ids.windFolder = res.body.id;
      expect((await api('lib', 'folders/folders/create', { ensembleId: ids.windClass, name: 'übungsheft' })).body.code).toBe('name-taken');
      expect((await api('lib', 'folders/folders/create', { ensembleId: ids.orchestra, name: 'Übungsheft' })).status).toBe(201);
    });

    it('adds scores with numbers in natural order and suggests the next number', async () => {
      const add = (scoreId: string, number: string) => api('lib', `folders/folders/${ids.windFolder}/add-score`, { scoreId, number });
      expect((await add(ids.march, '10')).status).toBe(204);
      expect((await add(ids.polka, '2')).status).toBe(204);
      expect((await add(ids.polka, '3')).body.code).toBe('conflict');
      const another = (await api('lib', 'scores/scores/create', { title: 'Florentiner Marsch', composer: null, arranger: null, publisher: null, publisherNumber: null, durationSeconds: null })).body.id;
      expect((await add(another, '10')).body.code).toBe('name-taken');
      expect((await add(another, '2a')).status).toBe(204);

      const entries = (await api('lib', `folders/folders/${ids.windFolder}/entries`)).body.items;
      expect(entries.map((e: { number: string }) => e.number)).toEqual(['2', '2a', '10']);
      const candidates = (await api('lib', `folders/folders/${ids.windFolder}/score-candidates?q=traum`)).body;
      expect(candidates).toMatchObject({ items: [{ title: 'Böhmischer Traum', alreadyContained: true }], suggestedNumber: '11' });
    });

    it('renumbers, shows/hides, removes and deletes', async () => {
      expect((await api('lib', `folders/folders/${ids.windFolder}/set-score-number`, { scoreId: ids.polka, number: '10' })).body.code).toBe('name-taken');
      expect((await api('lib', `folders/folders/${ids.windFolder}/set-score-number`, { scoreId: ids.polka, number: '1' })).status).toBe(204);
      expect((await api('lib', `folders/folders/${ids.windFolder}/set-visibility`, { showInMyArea: true })).status).toBe(204);
      expect((await api('lib', `folders/folders/${ids.windFolder}/details`)).body).toMatchObject({ showInMyArea: true, scoreCount: 3, ensemble: { name: 'Bläserklasse' } });
      expect((await api('lib', `folders/folders/${ids.windFolder}/remove-score`, { scoreId: ids.polka })).status).toBe(204);
      expect((await api('lib', `folders/folders/${ids.windFolder}/remove-score`, { scoreId: ids.polka })).status).toBe(404);
      expect((await api('lib', `scores/scores/${ids.march}/folders`)).body.items).toEqual([
        { folder: { id: ids.windFolder, name: 'Übungsheft' }, ensemble: { id: ids.windClass, name: 'Bläserklasse' }, number: '10' },
      ]);
      expect((await api('lib', `folders/folders/${ids.windFolder}/delete`, {})).status).toBe(204);
      expect((await api('lib', `folders/folders/${ids.windFolder}/details`)).status).toBe(404);
    });
  });

  describe('events (N-15, N-16)', () => {
    it('creates events and lists upcoming and past ones', async () => {
      const create = async (name: string, date: string) => (await api('board', 'events/events/create', { ensembleId: ids.youth, name, date })).body.id as string;
      ids.concert = await create('Jugendkonzert', addDays(today, 10));
      ids.pastEvent = await create('Sommerfest', addDays(today, -10));
      const names = async (period: string) => (await api('board', `events/event-list?period=${period}`)).body.items.map((e: { name: string }) => e.name);
      expect(await names('upcoming')).toEqual(['Jugendkonzert']);
      expect(await names('past')).toEqual(['Sommerfest']);
      expect((await api('lib', 'events/event-list')).body.items).toEqual([]);
    });

    it('sets the setlist in playing order; duplicates and unknown scores are refused', async () => {
      expect((await api('board', `events/events/${ids.concert}/set-setlist`, { scoreIds: [ids.polka, ids.march] })).status).toBe(204);
      expect((await api('board', `events/events/${ids.concert}/setlist`)).body.items.map((e: { position: number; title: string }) => [e.position, e.title])).toEqual([
        [1, 'Böhmischer Traum'],
        [2, 'Alte Kameraden'],
      ]);
      expect((await api('board', `events/events/${ids.concert}/set-setlist`, { scoreIds: [ids.march, ids.march] })).body.errors).toEqual([
        { path: '/body/scoreIds/1', code: 'duplicate' },
      ]);
      expect((await api('board', `events/events/${ids.concert}/set-setlist`, { scoreIds: [ids.orchestra] })).status).toBe(404);
      expect((await api('board', `events/events/${ids.concert}/score-candidates?q=alte`)).body.items).toEqual([
        { id: ids.march, title: 'Alte Kameraden', composer: 'Carl Teike', alreadyContained: true },
      ]);
    });

    it('updates details and visibility, deletes; other ensembles cannot touch it', async () => {
      expect((await api('board', `events/events/${ids.concert}/update-details`, { name: 'Frühjahrskonzert', date: addDays(today, 11) })).status).toBe(204);
      expect((await api('board', `events/events/${ids.concert}/set-visibility`, { showInMyArea: true })).status).toBe(204);
      expect((await api('board', `events/events/${ids.concert}/details`)).body).toMatchObject({ name: 'Frühjahrskonzert', showInMyArea: true });
      expect((await api('lib', `events/events/${ids.concert}/details`)).status).toBe(404);
      expect((await api('board', `events/events/${ids.pastEvent}/delete`, {})).status).toBe(204);
    });
  });

  describe('club tags (N-17)', () => {
    it('lists tags with score counts and keeps names unique', async () => {
      expect((await api('lib', 'tags/club-tag-list')).body.items).toEqual([{ id: ids.marchTag, name: 'Marsch', scoreCount: 2 }]);
      const xmas = (await api('lib', 'tags/club-tags/create', { name: 'Weihnachten' })).body.id;
      expect((await api('lib', `tags/club-tags/${xmas}/rename`, { name: 'marsch' })).body.code).toBe('name-taken');
      expect((await api('lib', `tags/club-tags/${ids.marchTag}/delete`, {})).status).toBe(204);
      expect((await api('lib', `scores/scores/${ids.march}/details`)).body.tags).toEqual([]);
    });
  });

  describe('lineup template (N-8)', () => {
    it('imports instruments, voices and substitutes once, reusing existing voices', async () => {
      const seed = new SeedService(testDb.db);
      const file = join(__dirname, '../../defaults/lineup.default.json');
      expect(await seed.runLineupTemplateSeed(file)).toBe(true);
      expect(await seed.runLineupTemplateSeed(file)).toBe(false);
      const groups = (await api('lib', 'voices/voice-list')).body.groups;
      const flute = groups.find((g: { instrument: { name: string } }) => g.instrument.name === 'Flöte');
      expect(flute.voices.map((v: { name: string }) => v.name)).toEqual(['Piccolo', 'Flöte 1', 'Flöte 2']);
      // existing "Horn 1 in F" kept its own substitutes, the template did not overwrite them
      const horn = groups.find((g: { instrument: { name: string } }) => g.instrument.name === 'Horn');
      expect(horn.voices.filter((v: { name: string }) => v.name === 'Horn 1 in F')).toHaveLength(1);
      const hornF2 = horn.voices.find((v: { name: string }) => v.name === 'Horn 2 in F');
      expect(hornF2.substitutes.map((s: { name: string }) => s.name)).toEqual(['Horn 2 in Es']);
    });
  });

  it('requires the CSRF token for library actions', async () => {
    const headers = await t.loginAs({ userId: ids.lib });
    delete headers[CSRF_HEADER];
    const res = await fetch(`${t.baseUrl}/tags/club-tags/create`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{"name":"x"}' });
    expect(res.status).toBe(403);
  });
});
