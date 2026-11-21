import { eq } from 'drizzle-orm';
import { fieldDefinitions, fieldOptions, folderEntries, folders, scores } from '../db/schema';
import { MeRepository } from '../me/me.repository';
import { expandPermissions } from '../seed/default-roles';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import { FILE_STORAGE } from '../storage/file-storage';
import { LibraryBuilder } from '../testing/library-builder';
import { createTestApp, type TestApp } from '../testing/test-app';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { FieldsService } from './fields.service';
import { ScoreImportService } from './score-import.service';
import { ScoresController } from './scores.controller';
import { ScoresRepository } from './scores.repository';
import { ScoresService } from './scores.service';

/** CSV import of scores (N-19) against a real PostgreSQL (TEST_DATABASE_URL). */
describe.skipIf(!TEST_DATABASE_URL)('CSV-Import (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let t: TestApp;
  const ids = {} as Record<string, string>;

  beforeAll(async () => {
    testDb = await createTestDatabase('scoreimport');
    const b = new LibraryBuilder(testDb.db);
    ids.root = await b.ensemble('Verein', null);
    ids.orchestra = await b.ensemble('Hauptorchester', ids.root);
    ids.youth = await b.ensemble('Jugendorchester', ids.root);
    await b.settings(ids.orchestra);

    const librarian = await b.role('Notenwart:in', expandPermissions(['score.*', 'folder.*']));
    const scoresOnly = await b.role('Stücke', expandPermissions(['score.*']));
    const viewer = await b.role('Lesend', ['score.view', 'score.create']);
    for (const [name, role] of [
      ['lib', librarian],
      ['scores', scoresOnly],
      ['viewer', viewer],
    ] as const) {
      ids[name] = await b.user(name);
      await b.member(ids[name], ids.orchestra, role);
    }

    ids.schoenfeld = await b.score('Schönfeld-Marsch', null);
    ids.konzertmappe = await b.folder(ids.orchestra, 'Konzertmappe');
    ids.taken = await b.score('Platzhalter', null);
    await b.inFolder(ids.konzertmappe, [[ids.taken, '7']]);
    await testDb.db.update(scores).set({ publisher: 'Rundel' }).where(eq(scores.id, ids.schoenfeld));

    t = await createTestApp(
      {
        controllers: [ScoresController],
        providers: [ScoresRepository, ScoresService, FieldsService, ScoreImportService, MeRepository, ClubSettingsRepository],
      },
      { database: testDb.db, providers: [{ provide: FILE_STORAGE, useValue: {} }] },
    );
  });

  afterAll(async () => {
    await t?.close();
    await testDb?.close();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const post = async (who: string, body: unknown): Promise<{ status: number; body: any }> => {
    const headers: Record<string, string> = await t.loginAs({ userId: ids[who] });
    headers['content-type'] = 'application/json';
    const res = await fetch(`${t.baseUrl}/scores/scores/import`, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  };

  const rows = [
    { line: 2, fixed: { title: 'Schönfeld-Marsch', composer: 'Carl Michael Ziehrer', publisher: 'Halter' }, custom: { 'new:genre': 'Marsch' }, folder: { name: 'Grünes Marschbuch', number: '1' } },
    { line: 3, fixed: { title: ' Waldzauber ', composer: 'Peter Fihn', duration: '3:30' }, custom: { 'new:genre': 'Walzer' }, folder: { name: 'konzertmappe', number: '3' } },
    { line: 4, fixed: { title: 'waldzauber', composer: 'Peter Fihn' }, custom: {}, folder: { name: 'Grünes Marschbuch', number: '2' } },
    { line: 5, fixed: { title: '' }, custom: {}, folder: null },
    { line: 6, fixed: { title: 'Neu mit belegter Nummer' }, custom: {}, folder: { name: 'Konzertmappe', number: '7' } },
    { line: 7, fixed: { title: 'Falsche Dauer', duration: 'lang' }, custom: {}, folder: null },
  ];
  const body = (dryRun: boolean, extra: object = {}) => ({
    dryRun,
    newFields: [{ key: 'genre', name: 'Genre', type: 'select' }],
    folderEnsembleId: ids.orchestra,
    rows,
    ...extra,
  });

  it('needs score.create and score.edit, and folder.edit for folder entries', async () => {
    expect((await post('viewer', body(true))).status).toBe(403);
    expect((await post('scores', body(true))).status).toBe(404); // no folder.view in the ensemble
    expect((await post('lib', body(true, { folderEnsembleId: ids.youth }))).status).toBe(404);
    expect((await post('lib', body(true, { folderEnsembleId: null }))).status).toBe(400);
    expect((await post('scores', { dryRun: true, rows: [{ line: 2, fixed: { title: 'Ohne Mappe' } }] })).status).toBe(200);
  });

  it('accepts large imports (over the 100 kB JSON limit of other routes)', async () => {
    const composer = 'K'.repeat(150);
    const big = Array.from({ length: 1000 }, (_, i) => ({ line: i + 2, fixed: { title: `Stück ${i}`, composer } }));
    const res = await post('lib', { dryRun: true, rows: big });
    expect(res.status).toBe(200);
    expect(res.body.summary.create).toBe(1000);

    const headers: Record<string, string> = await t.loginAs({ userId: ids.lib });
    headers['content-type'] = 'application/json';
    const tooBig = await fetch(`${t.baseUrl}/scores/scores/create`, { method: 'POST', headers, body: JSON.stringify({ title: 'x', padding: 'x'.repeat(200_000) }) });
    expect(tooBig.status).toBe(413);
  });

  it('previews matches, merges rows of the same file and writes nothing on a dry run', async () => {
    const res = await post('lib', body(true));
    expect(res.status).toBe(200);
    const byLine = Object.fromEntries(res.body.rows.map((r: { line: number }) => [r.line, r]));
    expect(byLine[2]).toMatchObject({ action: 'link', failed: false, match: { id: ids.schoenfeld, inFile: false }, folder: { name: 'Grünes Marschbuch', isNew: true } });
    expect(byLine[3]).toMatchObject({ action: 'create', title: 'Waldzauber', match: null, folder: { name: 'Konzertmappe', isNew: false } });
    expect(byLine[4]).toMatchObject({ action: 'link', match: { inFile: true } });
    expect(byLine[5]).toMatchObject({ failed: true, issues: [{ target: 'title', code: 'required', level: 'error' }] });
    expect(byLine[6]).toMatchObject({ action: 'create', failed: false, issues: [{ target: 'folder', code: 'folder-number-taken', level: 'warning' }] });
    expect(byLine[7]).toMatchObject({ failed: true, issues: [{ target: 'duration', code: 'invalid_duration' }] });
    expect(res.body.summary).toEqual({ create: 2, link: 2, overwrite: 0, skip: 0, failed: 2, newFolders: ['Grünes Marschbuch'], newOptions: 2 });
    expect(res.body.rows.every((r: { scoreId: unknown }) => r.scoreId === null)).toBe(true);

    expect(await testDb.db.select().from(fieldDefinitions)).toEqual([]);
    expect((await testDb.db.select().from(scores)).length).toBe(2);
  });

  it('imports: creates scores, fields, options and folders; link fills only empty fields', async () => {
    const res = await post('lib', body(false));
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ create: 2, link: 2, failed: 2 });

    const [genre] = await testDb.db.select().from(fieldDefinitions);
    expect(genre).toMatchObject({ name: 'Genre', type: 'select' });
    const options = await testDb.db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, genre.id));
    expect(options.map((o) => o.label).sort()).toEqual(['Marsch', 'Walzer']);
    const marsch = options.find((o) => o.label === 'Marsch')?.id;

    const [schoenfeld] = await testDb.db.select().from(scores).where(eq(scores.id, ids.schoenfeld));
    expect(schoenfeld).toMatchObject({ composer: 'Carl Michael Ziehrer', publisher: 'Rundel', customValues: { [genre.id]: marsch } });

    const waldzauber = res.body.rows.find((r: { line: number }) => r.line === 3).scoreId;
    expect(res.body.rows.find((r: { line: number }) => r.line === 4).scoreId).toBe(waldzauber);
    const [w] = await testDb.db.select().from(scores).where(eq(scores.id, waldzauber));
    expect(w).toMatchObject({ title: 'Waldzauber', composer: 'Peter Fihn', durationSeconds: 210 });

    const [gruen] = await testDb.db.select().from(folders).where(eq(folders.name, 'Grünes Marschbuch'));
    expect(gruen.ensembleId).toBe(ids.orchestra);
    const entries = await testDb.db.select().from(folderEntries);
    const of = (folderId: string) => entries.filter((e) => e.folderId === folderId).map((e) => [e.scoreId, e.number]);
    expect(of(gruen.id)).toEqual(expect.arrayContaining([[ids.schoenfeld, '1'], [waldzauber, '2']]));
    expect(of(ids.konzertmappe)).toEqual(expect.arrayContaining([[ids.taken, '7'], [waldzauber, '3']]));
    expect(of(ids.konzertmappe)).toHaveLength(2);
  });

  it('a second import matches the existing scores; overwrite replaces values, existing options are reused', async () => {
    const res = await post('lib', {
      dryRun: false,
      folderEnsembleId: ids.orchestra,
      rows: [{ line: 2, fixed: { title: 'Schönfeld-Marsch', publisher: 'Halter' }, action: 'overwrite', folder: { name: 'Grünes Marschbuch', number: '9' } }],
    });
    expect(res.status).toBe(200);
    expect(res.body.rows[0]).toMatchObject({ action: 'overwrite', issues: [{ code: 'folder-other-number', level: 'warning' }] });
    const [schoenfeld] = await testDb.db.select().from(scores).where(eq(scores.id, ids.schoenfeld));
    expect(schoenfeld.publisher).toBe('Halter');

    expect((await post('lib', body(true, { newFields: [{ key: 'genre', name: 'genre', type: 'text' }] }))).status).toBe(409);
  });
});
