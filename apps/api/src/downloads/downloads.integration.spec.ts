import { CSRF_HEADER } from '@vm-web/shared';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { clubSettings, ensemblePrintRules, sheets } from '../db/schema';
import { PrintRulesService } from '../print-rules/print-rules.service';
import { MeRepository } from '../me/me.repository';
import { MeService } from '../me/me.service';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import { FILE_STORAGE } from '../storage/file-storage';
import { FsFileStorage } from '../storage/fs-file-storage';
import { addDays, LibraryBuilder } from '../testing/library-builder';
import { createTestApp, type TestApp } from '../testing/test-app';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { todayIn } from '../common/time/today';
import { DownloadsController, PrintController } from './downloads.controller';
import { DownloadsService } from './downloads.service';
import { OutputService } from './output.service';

/** Minimal reader for stored (uncompressed) ZIP files: entry names and contents. */
function readZip(zip: Buffer): { name: string; data: Buffer }[] {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  const entries: { name: string; data: Buffer }[] = [];
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLength = zip.readUInt16LE(p + 28);
    const extraLength = zip.readUInt16LE(p + 30);
    const commentLength = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nameLength).toString('utf8');
    expect(method).toBe(0); // stored
    const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    entries.push({ name, data: zip.subarray(dataStart, dataStart + size) });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function pdf(pages: number, label: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(label);
  for (let i = 0; i < pages; i++) doc.addPage([600, 800]).drawText(`${label} ${i + 1}`, { x: 40, y: 700 });
  return Buffer.from(await doc.save());
}

describe.skipIf(!TEST_DATABASE_URL)('Druck und Download (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let t: TestApp;
  let storageDir: string;
  let storage: FsFileStorage;
  const ids = {} as Record<string, string>;
  const today = todayIn('Europe/Berlin');

  beforeAll(async () => {
    testDb = await createTestDatabase('downloads');
    storageDir = await mkdtemp(join(tmpdir(), 'vmweb-dl-'));
    storage = new FsFileStorage(storageDir);
    await storage.init();
    const b = new LibraryBuilder(testDb.db);

    ids.root = await b.ensemble('Verein', null);
    ids.orchestra = await b.ensemble('Hauptorchester', ids.root);
    ids.youth = await b.ensemble('Jugendorchester', ids.root);
    await b.settings(ids.orchestra);
    await testDb.db.update(clubSettings).set({ browserPrintPageLimit: 3 });

    const musician = await b.role('Musiker:in', ['sheet.upload']);
    const printer = await b.role('Druckwart:in', ['score.view', 'folder.view', 'event.view']);
    ids.anna = await b.user('Anna');
    ids.ben = await b.user('Ben');
    ids.pia = await b.user('Pia');
    await b.member(ids.anna, ids.orchestra, musician);
    await b.member(ids.ben, ids.youth, musician);
    await b.member(ids.pia, ids.youth, printer);

    const trumpet = await b.instrument('Trompete');
    const flugel = await b.instrument('Flügelhorn');
    ids.tp1 = await b.voice(trumpet, 'Trompete 1 in B');
    ids.tp2 = await b.voice(trumpet, 'Trompete 2 in B');
    ids.flh1 = await b.voice(flugel, 'Flügelhorn 1 in B');
    await b.substitutes(ids.tp1, [ids.flh1]);
    await b.profileVoices(ids.anna, [ids.tp1]);

    ids.march = await b.score('Alte Kameraden');
    ids.polka = await b.score('Böhmischer Traum');
    ids.hymn = await b.score('Highland Cathedral');
    ids.secret = await b.score('Geheim/Stück');
    const files: [string, string, string, number][] = [
      ['marchTp1', ids.march, ids.tp1, 1],
      ['marchFlh1', ids.march, ids.flh1, 2],
      ['polkaFlh1', ids.polka, ids.flh1, 2],
      ['hymnTp2', ids.hymn, ids.tp2, 3],
      ['secretTp1', ids.secret, ids.tp1, 1],
    ];
    for (const [key, scoreId, voiceId, pages] of files) {
      ids[key] = await b.sheet(scoreId, voiceId, pages);
      await storage.write(`sheets/${ids[key]}.pdf`, await pdf(pages, key));
    }

    ids.marschbuch = await b.folder(ids.orchestra, 'Marschbuch');
    await b.inFolder(ids.marschbuch, [
      [ids.march, '2'],
      [ids.polka, '10'],
      [ids.hymn, '1'],
    ]);
    ids.hidden = await b.folder(ids.orchestra, 'Entwürfe', false);
    await b.inFolder(ids.hidden, [[ids.secret, '1']]);
    ids.youthHidden = await b.folder(ids.youth, 'Jugend intern', false);
    await b.inFolder(ids.youthHidden, [[ids.polka, '1']]);
    ids.concert = await b.event(ids.orchestra, 'Konzert', addDays(today, 3));
    await b.setlist(ids.concert, [ids.polka, ids.march]);

    t = await createTestApp(
      { controllers: [DownloadsController, PrintController], providers: [DownloadsService, OutputService, MeRepository, MeService, ClubSettingsRepository, PrintRulesService] },
      { database: testDb.db, providers: [{ provide: FILE_STORAGE, useValue: storage }], config: { APP_TIMEZONE: 'Europe/Berlin' } },
    );
  });

  afterAll(async () => {
    await t?.close();
    await testDb?.close();
    if (storageDir) await rm(storageDir, { recursive: true, force: true });
  });

  type Who = 'anna' | 'ben' | 'pia';
  const fetchAs = async (who: Who | null, path: string, body?: unknown, opts: { csrf?: boolean } = {}) => {
    const headers: Record<string, string> = who ? await t.loginAs({ userId: ids[who] }) : {};
    if (opts.csrf === false) delete headers[CSRF_HEADER];
    const init: RequestInit = { headers };
    if (body !== undefined) {
      init.method = 'POST';
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${t.baseUrl}/${path}`, init);
    return { status: res.status, headers: res.headers, bytes: Buffer.from(await res.arrayBuffer()) };
  };
  const fileName = (headers: Headers) => decodeURIComponent((headers.get('content-disposition') ?? '').split("UTF-8''")[1] ?? '');
  const json = (r: { bytes: Buffer }) => JSON.parse(r.bytes.toString('utf8'));

  describe('single PDF (M-6)', () => {
    it('downloads a sheet with „Titel – Stimme.pdf“, with folder context „Nr – Titel – Stimme.pdf“', async () => {
      const plain = await fetchAs('anna', `me/sheets/${ids.marchTp1}/pdf`);
      expect(plain.status).toBe(200);
      expect(plain.headers.get('content-type')).toBe('application/pdf');
      expect(plain.headers.get('content-disposition')).toMatch(/^attachment;/);
      expect(fileName(plain.headers)).toBe('Alte Kameraden – Trompete 1 in B.pdf');
      // the stored file is delivered unchanged
      expect((await PDFDocument.load(plain.bytes)).getTitle()).toBe('marchTp1');

      const numbered = await fetchAs('anna', `me/sheets/${ids.marchTp1}/pdf?folderId=${ids.marschbuch}&disposition=inline`);
      expect(fileName(numbered.headers)).toBe('2 – Alte Kameraden – Trompete 1 in B.pdf');
      expect(numbered.headers.get('content-disposition')).toMatch(/^inline;/);
    });

    it('allows other voices of visible scores (M-2) but nothing outside Mein Bereich', async () => {
      expect((await fetchAs('anna', `me/sheets/${ids.hymnTp2}/pdf`)).status).toBe(200);
      expect((await fetchAs('anna', `me/sheets/${ids.secretTp1}/pdf`)).status).toBe(404);
      expect((await fetchAs('ben', `me/sheets/${ids.marchTp1}/pdf`)).status).toBe(404);
      expect((await fetchAs('anna', `me/sheets/${ids.marchTp1}/pdf?folderId=${ids.hidden}`)).status).toBe(404);
      // print rights do not open downloads (F-9 only covers printing)
      expect((await fetchAs('pia', `me/sheets/${ids.marchTp1}/pdf`)).status).toBe(404);
      expect((await fetchAs(null, `me/sheets/${ids.marchTp1}/pdf`)).status).toBe(401);
    });
  });

  describe('ZIP (M-6, F-7)', () => {
    it('zips a folder in number order, one PDF per score, substitute as fallback', async () => {
      const res = await fetchAs('anna', `me/folders/${ids.marschbuch}/zip`);
      expect(res.headers.get('content-type')).toBe('application/zip');
      expect(fileName(res.headers)).toBe('Marschbuch – Trompete 1 in B.zip');
      const entries = readZip(res.bytes);
      expect(entries.map((e) => e.name)).toEqual(['2 – Alte Kameraden – Trompete 1 in B.pdf', '10 – Böhmischer Traum – Flügelhorn 1 in B.pdf']);
      expect((await PDFDocument.load(entries[0].data)).getTitle()).toBe('marchTp1');
    });

    it('follows the voice switch and the substitute mode', async () => {
      const tp2 = readZip((await fetchAs('anna', `me/folders/${ids.marschbuch}/zip?voiceId=${ids.tp2}`)).bytes);
      expect(tp2.map((e) => e.name)).toEqual(['1 – Highland Cathedral – Trompete 2 in B.pdf']);
      const all = readZip((await fetchAs('anna', `me/folders/${ids.marschbuch}/zip?substitutes=all`)).bytes);
      expect(all.map((e) => e.name)).toEqual([
        '2 – Alte Kameraden – Trompete 1 in B.pdf',
        '2 – Alte Kameraden – Flügelhorn 1 in B.pdf',
        '10 – Böhmischer Traum – Flügelhorn 1 in B.pdf',
      ]);
      expect(readZip((await fetchAs('anna', `me/folders/${ids.marschbuch}/zip?substitutes=none`)).bytes)).toHaveLength(1);
    });

    it('numbers event ZIPs by setlist position', async () => {
      const res = await fetchAs('anna', `me/events/${ids.concert}/zip`);
      expect(fileName(res.headers)).toBe(`${addDays(today, 3)} Konzert – Trompete 1 in B.zip`);
      expect(readZip(res.bytes).map((e) => e.name)).toEqual(['01 – Böhmischer Traum – Flügelhorn 1 in B.pdf', '02 – Alte Kameraden – Trompete 1 in B.pdf']);
    });

    it('zips a selection, with folder numbers as context and without CSRF refused', async () => {
      const withContext = await fetchAs('anna', 'me/downloads/selection-zip', { scoreIds: [ids.polka, ids.march], folderId: ids.marschbuch });
      expect(withContext.status).toBe(200);
      expect(readZip(withContext.bytes).map((e) => e.name)).toEqual(['2 – Alte Kameraden – Trompete 1 in B.pdf', '10 – Böhmischer Traum – Flügelhorn 1 in B.pdf']);
      const plain = await fetchAs('anna', 'me/downloads/selection-zip', { scoreIds: [ids.polka] });
      expect(fileName(plain.headers)).toBe('Auswahl – Trompete 1 in B.zip');
      expect(readZip(plain.bytes).map((e) => e.name)).toEqual(['Böhmischer Traum – Flügelhorn 1 in B.pdf']);
      expect((await fetchAs('anna', 'me/downloads/selection-zip', { scoreIds: [ids.secret] })).status).toBe(404);
      expect((await fetchAs('anna', 'me/downloads/selection-zip', { scoreIds: [ids.march] }, { csrf: false })).status).toBe(403);
    });

    it('answers 404 for folders and events outside Mein Bereich', async () => {
      expect((await fetchAs('anna', `me/folders/${ids.hidden}/zip`)).status).toBe(404);
      expect((await fetchAs('ben', `me/events/${ids.concert}/zip`)).status).toBe(404);
    });

    it('leaves out files missing in storage instead of failing the whole ZIP', async () => {
      const [row] = await testDb.db.select().from(sheets).where(eq(sheets.id, ids.polkaFlh1));
      const backup = await storage.read(row.fileKey);
      const chunks: Buffer[] = [];
      for await (const c of backup) chunks.push(c as Buffer);
      await storage.delete(row.fileKey);
      try {
        const entries = readZip((await fetchAs('anna', `me/folders/${ids.marschbuch}/zip`)).bytes);
        expect(entries.map((e) => e.name)).toEqual(['2 – Alte Kameraden – Trompete 1 in B.pdf']);
      } finally {
        await storage.write(row.fileKey, Buffer.concat(chunks));
      }
    });
  });

  describe('print (D-1, D-2, D-3, D-6, F-9)', () => {
    it('plans by the default rules with blank pages, page limit and missing scores', async () => {
      const plan = json(await fetchAs('anna', `print/print-plan?scope=folder&folderId=${ids.marschbuch}`));
      expect(plan).toEqual({
        totalPages: 4, // 1 + blank back page (single-sided) + 2
        pageLimit: 3,
        route: 'print-service',
        duplex: true,
        rules: { source: null, items: [{ fromPages: 1, mode: 'simplex' }, { fromPages: 2, mode: 'duplex' }] },
        documents: [
          expect.objectContaining({ number: '2', title: 'Alte Kameraden', kind: 'own', pages: 1, mode: 'simplex', sheets: 1, blankPagesAfter: 1 }),
          expect.objectContaining({ number: '10', title: 'Böhmischer Traum', kind: 'substitute', pages: 2, mode: 'duplex', sheets: 1, blankPagesAfter: 0 }),
        ],
        missing: [{ id: ids.hymn, name: 'Highland Cathedral' }],
      });
      const single = json(await fetchAs('anna', `print/print-plan?scope=score&scoreId=${ids.march}`));
      expect(single).toMatchObject({ totalPages: 1, route: 'browser', duplex: false });
    });

    it('applies the print rules of the folder ensemble, inherited by sub-ensembles (D-6, F-3)', async () => {
      await testDb.db.insert(ensemblePrintRules).values([{ ensembleId: ids.root, fromPages: 1, mode: 'simplex' }]);
      const plan = json(await fetchAs('anna', `print/print-plan?scope=folder&folderId=${ids.marschbuch}`));
      expect(plan).toMatchObject({ totalPages: 3, duplex: false, rules: { source: { id: ids.root, name: 'Verein' } } });
      expect((await PDFDocument.load((await fetchAs('anna', `print/document?scope=folder&folderId=${ids.marschbuch}`)).bytes)).getPageCount()).toBe(3);
      await testDb.db.delete(ensemblePrintRules);
    });

    it('builds the print-ready PDF matching the plan', async () => {
      const res = await fetchAs('anna', `print/document?scope=folder&folderId=${ids.marschbuch}`);
      expect(res.headers.get('content-type')).toBe('application/pdf');
      expect(fileName(res.headers)).toBe('Druck – Marschbuch – Trompete 1 in B.pdf');
      const doc = await PDFDocument.load(res.bytes);
      expect(doc.getPageCount()).toBe(4);
      expect(doc.getPages().every((p) => Math.round(p.getWidth()) === 595 && Math.round(p.getHeight()) === 842)).toBe(true);
    });

    it('lets view permissions print beyond Mein Bereich (F-9)', async () => {
      // pia has score.view (any score) and folder.view only in the youth orchestra
      expect((await fetchAs('pia', `print/print-plan?scope=score&scoreId=${ids.secret}&voiceId=${ids.tp1}`)).status).toBe(200);
      const secret = await fetchAs('pia', `print/document?scope=score&scoreId=${ids.secret}&voiceId=${ids.tp1}`);
      expect(fileName(secret.headers)).toBe('Druck – Geheim_Stück – Trompete 1 in B.pdf');
      expect((await fetchAs('pia', `print/print-plan?scope=folder&folderId=${ids.youthHidden}&voiceId=${ids.flh1}`)).status).toBe(200);
      expect((await fetchAs('pia', `print/print-plan?scope=folder&folderId=${ids.hidden}`)).status).toBe(404);
      // a plain member prints only Mein Bereich
      expect((await fetchAs('ben', `print/print-plan?scope=score&scoreId=${ids.march}`)).status).toBe(404);
      expect((await fetchAs('anna', `print/print-plan?scope=folder&folderId=${ids.hidden}`)).status).toBe(404);
    });

    it('validates the scope and refuses empty print documents', async () => {
      expect(json(await fetchAs('anna', 'print/print-plan?scope=folder')).errors).toEqual([{ path: '/query/folderId', code: 'custom' }]);
      expect((await fetchAs('anna', `print/document?scope=score&scoreId=${ids.hymn}`)).status).toBe(404);
    });
  });
});
