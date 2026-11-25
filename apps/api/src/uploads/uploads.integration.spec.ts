import { MulterModule } from '@nestjs/platform-express';
import { and, eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { degrees, PDFDocument } from 'pdf-lib';
import { ensureUploadTempDir } from '../common/files/upload-temp';
import { sheets, uploads } from '../db/schema';
import { MeController } from '../me/me.controller';
import { MeRepository } from '../me/me.repository';
import { MeService } from '../me/me.service';
import { PersonalTagsService } from '../me/personal-tags.service';
import { FILE_STORAGE } from '../storage/file-storage';
import { FsFileStorage } from '../storage/fs-file-storage';
import { streamToBuffer } from '../storage/stream-utils';
import { LibraryBuilder } from '../testing/library-builder';
import { createTestApp, type TestApp } from '../testing/test-app';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

const MAX_FILE_BYTES = 200 * 1024;

async function pdf(pageCount: number, opts: { rotate?: number } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([600, 800]);
    page.drawText(`Seite ${i + 1}`, { x: 50, y: 700 });
    if (opts.rotate) page.setRotation(degrees(opts.rotate));
  }
  return doc.save();
}

describe.skipIf(!TEST_DATABASE_URL)('Upload und Prüfung (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let t: TestApp;
  let storageDir: string;
  let storage: FsFileStorage;
  const ids = {} as Record<string, string>;

  beforeAll(async () => {
    testDb = await createTestDatabase('uploads');
    storageDir = await mkdtemp(join(tmpdir(), 'vmweb-up-store-'));
    storage = new FsFileStorage(storageDir);
    await storage.init();
    const b = new LibraryBuilder(testDb.db);

    ids.root = await b.ensemble('Verein', null);
    ids.orchestra = await b.ensemble('Hauptorchester', ids.root);
    ids.youth = await b.ensemble('Jugendorchester', ids.root);
    const roles = {
      musician: await b.role('Musiker:in', ['sheet.upload']),
      librarian: await b.role('Notenwart:in', ['sheet.upload', 'sheet.approve', 'score.view', 'score.edit']),
      chief: await b.role('Chef-Notenwart:in', ['sheet.approve', 'score.delete']),
      plain: await b.role('Ohne Rechte', []),
    };
    for (const [name, ensemble, role] of [
      ['mus', ids.orchestra, roles.musician],
      ['lib', ids.orchestra, roles.librarian],
      ['chief', ids.youth, roles.chief],
      ['plain', ids.orchestra, roles.plain],
      ['outsider', ids.youth, roles.musician],
    ] as const) {
      ids[name] = await b.user(name);
      await b.member(ids[name], ensemble, role);
    }

    const trumpet = await b.instrument('Trompete');
    ids.tp1 = await b.voice(trumpet, 'Trompete 1 in B');
    ids.tp2 = await b.voice(trumpet, 'Trompete 2 in B');
    ids.march = await b.score('Alte Kameraden', 'Carl Teike');
    ids.secret = await b.score('Geheimstück');
    const folder = await b.folder(ids.orchestra, 'Marschbuch');
    await b.inFolder(folder, [[ids.march, '1']]);

    t = await createTestApp(
      {
        imports: [MulterModule.register({ dest: ensureUploadTempDir(), limits: { fileSize: MAX_FILE_BYTES, files: 50 } })],
        controllers: [UploadsController, ReviewController, MeController],
        providers: [UploadsService, ReviewService, MeRepository, MeService, PersonalTagsService],
      },
      { database: testDb.db, providers: [{ provide: FILE_STORAGE, useValue: storage }], config: { APP_TIMEZONE: 'Europe/Berlin' } },
    );
  });

  afterAll(async () => {
    await t?.close();
    await testDb?.close();
    if (storageDir) await rm(storageDir, { recursive: true, force: true });
  });

  type Who = 'mus' | 'lib' | 'chief' | 'plain' | 'outsider';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Res = { status: number; body: any };
  const json = async (res: Response): Promise<Res> => {
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  };
  const get = async (who: Who | null, path: string) =>
    json(await fetch(`${t.baseUrl}/${path}`, { headers: who ? await t.loginAs({ userId: ids[who] }) : {} }));
  const post = async (who: Who, path: string, body: unknown) =>
    json(
      await fetch(`${t.baseUrl}/${path}`, {
        method: 'POST',
        headers: { ...(await t.loginAs({ userId: ids[who] })), 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  const upload = async (who: Who, files: { name: string; bytes: Uint8Array }[], meta: unknown) => {
    const form = new FormData();
    for (const f of files) form.append('files', new Blob([Buffer.from(f.bytes)], { type: 'application/pdf' }), f.name);
    if (meta !== undefined) form.append('meta', typeof meta === 'string' ? meta : JSON.stringify(meta));
    return json(await fetch(`${t.baseUrl}/uploads/sheets/upload`, { method: 'POST', headers: await t.loginAs({ userId: ids[who] }), body: form }));
  };
  const item = (fileName: string, scoreId: string | null = null, voiceId: string | null = null) => ({ fileName, scoreId, voiceId });

  describe('permissions (F-2, F-4)', () => {
    it('needs sheet.upload for the dialog and sheet.approve for the review', async () => {
      const results = await Promise.all([
        get('mus', 'uploads/voice-suggestions?fileName=x.pdf'),
        get('plain', 'uploads/voice-suggestions?fileName=x.pdf'),
        upload('plain', [{ name: 'a.pdf', bytes: await pdf(1) }], { items: [item('a.pdf')] }),
        get('mus', 'review/queue'),
        get('lib', 'review/queue'),
        get('chief', 'review/queue'),
        get(null, 'review/queue'),
      ]);
      expect(results.map((r) => r.status)).toEqual([200, 403, 403, 403, 200, 200, 401]);
    });

    it('searches only visible scores without score.view (R-2)', async () => {
      const titles = async (who: Who) => (await get(who, 'uploads/score-search?q=e')).body.items.map((s: { title: string }) => s.title);
      expect(await titles('mus')).toEqual(['Alte Kameraden']);
      expect(await titles('outsider')).toEqual([]);
      expect(await titles('lib')).toEqual(['Alte Kameraden', 'Geheimstück']);
    });
  });

  describe('upload (N-10, N-11, M-9)', () => {
    it('suggests voices from file names', async () => {
      const res = await get('mus', 'uploads/voice-suggestions?fileName=Kameraden%20Trp%202.pdf&fileName=scan.pdf');
      expect(res.body.items).toEqual([
        { fileName: 'Kameraden Trp 2.pdf', voice: { id: ids.tp2, name: 'Trompete 2 in B', instrumentId: expect.any(String) } },
        { fileName: 'scan.pdf', voice: null },
      ]);
    });

    it('stores uploads of members as pending (N-10)', async () => {
      const res = await upload(
        'mus',
        [
          { name: 'Kameraden Trp 1.pdf', bytes: await pdf(2) },
          { name: 'scan.pdf', bytes: await pdf(3, { rotate: 90 }) },
        ],
        { items: [item('Kameraden Trp 1.pdf', ids.march, ids.tp1), item('scan.pdf')] },
      );
      expect(res.status).toBe(201);
      expect(res.body.items.map((i: { status: string; pageCount: number; sheetId: string | null }) => [i.status, i.pageCount, i.sheetId])).toEqual([
        ['pending', 2, null],
        ['pending', 3, null],
      ]);
      ids.musUpload1 = res.body.items[0].uploadId;
      ids.musUpload2 = res.body.items[1].uploadId;
      expect(await storage.stat(`uploads/${ids.musUpload1}.pdf`)).not.toBeNull();
    });

    it('approves uploads of approvers immediately, but only if no sheet exists yet (N-10, F-11)', async () => {
      const first = await upload('lib', [{ name: 'tp2.pdf', bytes: await pdf(1) }], { items: [item('tp2.pdf', ids.march, ids.tp2)] });
      expect(first.body.items[0]).toMatchObject({ status: 'approved', pageCount: 1 });
      ids.tp2Sheet = first.body.items[0].sheetId;
      expect(await storage.stat(`sheets/${ids.tp2Sheet}.pdf`)).not.toBeNull();

      const second = await upload('lib', [{ name: 'tp2-neu.pdf', bytes: await pdf(3) }], { items: [item('tp2-neu.pdf', ids.march, ids.tp2)] });
      expect(second.body.items[0]).toMatchObject({ status: 'pending', sheetId: null });
      ids.libReplacement = second.body.items[0].uploadId;

      // without score and voice even approvers go through the review
      const third = await upload('lib', [{ name: 'x.pdf', bytes: await pdf(1) }], { items: [item('x.pdf')] });
      expect(third.body.items[0].status).toBe('pending');
      ids.libLoose = third.body.items[0].uploadId;
    });

    it('rejects files that are no readable PDF, all at once and before storing anything (415)', async () => {
      const before = (await testDb.db.select().from(uploads)).length;
      const res = await upload(
        'mus',
        [
          { name: 'ok.pdf', bytes: await pdf(1) },
          { name: 'bild.pdf', bytes: Buffer.from('\u0089PNG fake') },
          { name: 'kaputt.pdf', bytes: Buffer.from('%PDF-1.7 broken') },
        ],
        { items: [item('ok.pdf'), item('bild.pdf'), item('kaputt.pdf')] },
      );
      expect(res).toMatchObject({
        status: 415,
        body: { code: 'unsupported-media-type', errors: [{ path: '/files/1', code: 'not_pdf' }, { path: '/files/2', code: 'damaged' }] },
      });
      expect((await testDb.db.select().from(uploads)).length).toBe(before);
    });

    it('validates meta, targets and file limits', async () => {
      const one = [{ name: 'a.pdf', bytes: await pdf(1) }];
      expect((await upload('mus', one, { items: [item('a.pdf'), item('b.pdf')] })).body.errors).toEqual([{ path: '/body/meta/items', code: 'count_mismatch' }]);
      expect((await upload('mus', one, 'not json')).body.errors).toEqual([{ path: '/body/meta', code: 'invalid_json' }]);
      expect((await upload('mus', [], { items: [item('a.pdf')] })).body.errors).toEqual([{ path: '/files', code: 'too_small' }]);
      expect((await upload('mus', one, { items: [item('a.pdf', ids.secret, ids.tp1)] })).status).toBe(404);
      expect((await upload('mus', one, { items: [item('a.pdf', ids.march, ids.march)] })).status).toBe(404);
      const big = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(MAX_FILE_BYTES + 10, 32)]);
      expect((await upload('mus', [{ name: 'gross.pdf', bytes: big }], { items: [item('gross.pdf')] })).body).toMatchObject({
        status: 413,
        code: 'payload-too-large',
      });
    });
  });

  describe('own uploads (N-14)', () => {
    it('lists own uploads newest first and summarizes them', async () => {
      const mine = await get('mus', 'me/my-uploads');
      expect(mine.body.items.map((u: { fileName: string; status: string }) => [u.fileName, u.status])).toEqual([
        ['scan.pdf', 'pending'],
        ['Kameraden Trp 1.pdf', 'pending'],
      ]);
      expect(mine.body.items[1]).toMatchObject({ score: { id: ids.march, name: 'Alte Kameraden' }, voice: { id: ids.tp1, name: 'Trompete 1 in B' } });
      expect((await get('mus', 'me/upload-summary')).body).toEqual({ pending: 2, recentlyRejected: 0, recentlyApproved: 0 });
      expect((await get('outsider', 'me/my-uploads')).body.items).toEqual([]);
    });
  });

  describe('review (N-12, N-13, N-14)', () => {
    it('shows the queue oldest first with neighbours for „Annehmen & weiter“', async () => {
      const queue = (await get('lib', 'review/queue')).body;
      expect(queue.totalPending).toBe(4);
      expect(queue.items.map((i: { uploadId: string }) => i.uploadId)).toEqual([ids.musUpload1, ids.musUpload2, ids.libReplacement, ids.libLoose]);
      expect(queue.items[0]).toMatchObject({ uploadedBy: { id: ids.mus, name: 'mus' }, pageCount: 2, score: { name: 'Alte Kameraden' } });

      const details = (await get('lib', `review/uploads/${ids.musUpload2}/details`)).body;
      expect(details).toMatchObject({ status: 'pending', previousUploadId: ids.musUpload1, nextUploadId: ids.libReplacement, existingSheetId: null });
      expect((await get('lib', `review/uploads/${ids.libReplacement}/details`)).body.existingSheetId).toBe(ids.tp2Sheet);
    });

    it('streams the original PDF', async () => {
      const res = await fetch(`${t.baseUrl}/review/uploads/${ids.musUpload2}/pdf`, { headers: await t.loginAs({ userId: ids.lib }) });
      expect(res.headers.get('content-type')).toBe('application/pdf');
      expect((await PDFDocument.load(new Uint8Array(await res.arrayBuffer()))).getPageCount()).toBe(3);
    });

    it('approves with page selection, rotation and crop, then moves on (N-12)', async () => {
      const res = await post('lib', `review/uploads/${ids.musUpload2}/approve`, {
        scoreId: ids.march,
        voiceId: ids.tp1,
        pages: [
          { sourcePage: 3, rotation: 0, crop: null },
          { sourcePage: 1, rotation: 270, crop: { x: 0, y: 0, width: 0.5, height: 0.5 } },
        ],
      });
      expect(res.status).toBe(200);
      expect(res.body.nextUploadId).toBe(ids.libReplacement);
      const [sheet] = await testDb.db.select().from(sheets).where(eq(sheets.id, res.body.sheetId));
      expect(sheet).toMatchObject({ scoreId: ids.march, voiceId: ids.tp1, pageCount: 2, uploadId: ids.musUpload2, approvedBy: ids.lib });
      const doc = await PDFDocument.load(await streamToBuffer(await storage.read(sheet.fileKey)));
      expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([90, 0]);
      expect(doc.getPage(1).getCropBox()).toEqual({ x: 0, y: 400, width: 300, height: 400 });

      expect((await post('lib', `review/uploads/${ids.musUpload2}/approve`, { scoreId: ids.march, voiceId: ids.tp1, pages: [{ sourcePage: 1, rotation: 0, crop: null }] })).body.code).toBe(
        'upload-not-pending',
      );
      expect((await get('mus', 'me/upload-summary')).body).toMatchObject({ pending: 1, recentlyApproved: 1 });
    });

    it('refuses pages beyond the upload and existing sheets without replace (F-11)', async () => {
      expect(
        (await post('lib', `review/uploads/${ids.musUpload1}/approve`, { scoreId: ids.march, voiceId: ids.tp1, pages: [{ sourcePage: 3, rotation: 0, crop: null }] })).body.errors,
      ).toEqual([{ path: '/body/pages/0/sourcePage', code: 'too_big' }]);
      // tp1 got its sheet in the previous test
      expect(
        (await post('lib', `review/uploads/${ids.musUpload1}/approve`, { scoreId: ids.march, voiceId: ids.tp1, pages: [{ sourcePage: 1, rotation: 0, crop: null }] })).body.code,
      ).toBe('sheet-exists');
    });

    it('replaces an existing sheet only with score.delete, keeping its id (F-11)', async () => {
      const body = { scoreId: ids.march, voiceId: ids.tp2, pages: [1, 2, 3].map((p) => ({ sourcePage: p, rotation: 0, crop: null })), replaceExisting: true };
      expect((await post('lib', `review/uploads/${ids.libReplacement}/approve`, body)).status).toBe(403);
      const [before] = await testDb.db.select().from(sheets).where(eq(sheets.id, ids.tp2Sheet));

      const res = await post('chief', `review/uploads/${ids.libReplacement}/approve`, body);
      expect(res).toMatchObject({ status: 200, body: { sheetId: ids.tp2Sheet } });
      const [after] = await testDb.db.select().from(sheets).where(eq(sheets.id, ids.tp2Sheet));
      expect(after).toMatchObject({ pageCount: 3, uploadId: ids.libReplacement, approvedBy: ids.chief });
      expect(await storage.stat(before.fileKey)).toBeNull();
      expect(await storage.stat(after.fileKey)).not.toBeNull();
      expect(await testDb.db.select().from(sheets).where(and(eq(sheets.scoreId, ids.march), eq(sheets.voiceId, ids.tp2)))).toHaveLength(1);
    });

    it('rejects with a reason the uploader sees (N-14)', async () => {
      const res = await post('lib', `review/uploads/${ids.musUpload1}/reject`, { reason: 'Seite 2 fehlt' });
      expect(res.status).toBe(200);
      expect((await post('lib', `review/uploads/${ids.musUpload1}/reject`, { reason: 'nochmal' })).body.code).toBe('upload-not-pending');
      const mine = (await get('mus', 'me/my-uploads?status=rejected')).body.items;
      expect(mine).toEqual([expect.objectContaining({ fileName: 'Kameraden Trp 1.pdf', status: 'rejected', rejectionReason: 'Seite 2 fehlt', decidedAt: expect.any(String) })]);
      expect((await get('mus', 'me/upload-summary')).body).toEqual({ pending: 0, recentlyRejected: 1, recentlyApproved: 1 });
      expect((await get('lib', 'review/queue')).body.totalPending).toBe(1);
    });
  });
});
