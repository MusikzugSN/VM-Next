import { MulterModule } from '@nestjs/platform-express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { OIDC_CLIENT } from '../auth/oidc.client';
import { USERS_REPOSITORY } from '../auth/users.repository';
import { LegalService } from '../legal/legal.service';
import { FILE_STORAGE } from '../storage/file-storage';
import { FsFileStorage } from '../storage/fs-file-storage';
import { ConfigRepository } from '../system/config.repository';
import { ConfigService } from '../system/config.service';
import { SystemConfigController } from '../system/system.controller';
import { logoMulterOptions } from '../system/system.module';
import { LibraryBuilder } from '../testing/library-builder';
import { createTestApp, type TestApp } from '../testing/test-app';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { ClubSettingsRepository } from './club-settings.repository';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const legalLinks = {
  imprint: { kind: 'internal', href: '/impressum' },
  privacy: { kind: 'internal', href: '/datenschutz' },
};

describe.skipIf(!TEST_DATABASE_URL)('Vereinseinstellungen (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let t: TestApp;
  let storageDir: string;
  let storage: FsFileStorage;
  const ids = {} as Record<string, string>;

  beforeAll(async () => {
    testDb = await createTestDatabase('settings');
    storageDir = await mkdtemp(join(tmpdir(), 'vmweb-settings-'));
    storage = new FsFileStorage(storageDir);
    await storage.init();

    const b = new LibraryBuilder(testDb.db);
    ids.root = await b.ensemble('Verein', null);
    ids.orchestra = await b.ensemble('Hauptorchester', ids.root);
    await b.settings(ids.root);

    const board = await b.role('Vorstand', ['config.view', 'config.edit']);
    const treasurer = await b.role('Kassenwart:in', ['config.view']);
    const musician = await b.role('Musiker:in', ['score.view']);
    ids.eva = await b.user('Eva');
    ids.vik = await b.user('Vik');
    ids.mo = await b.user('Mo');
    await b.member(ids.eva, ids.orchestra, board);
    await b.member(ids.vik, ids.orchestra, treasurer);
    await b.member(ids.mo, ids.orchestra, musician);

    t = await createTestApp(
      {
        imports: [MulterModule.registerAsync({ useFactory: logoMulterOptions })],
        controllers: [AuthController, SystemConfigController],
        providers: [ClubSettingsRepository, AuthService, ConfigRepository, ConfigService],
      },
      {
        database: testDb.db,
        providers: [
          { provide: FILE_STORAGE, useValue: storage },
          { provide: OIDC_CLIENT, useValue: {} },
          { provide: USERS_REPOSITORY, useValue: {} },
          { provide: LegalService, useValue: { links: async () => legalLinks } },
        ],
      },
    );
  });

  afterAll(async () => {
    await t?.close();
    await testDb?.close();
    if (storageDir) await rm(storageDir, { recursive: true, force: true });
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
    const res = await fetch(`${t.baseUrl}/${path}`, init);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  };
  const uploadLogo = async (who: Who, bytes: Buffer) => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(bytes)]), 'logo.png');
    const res = await fetch(`${t.baseUrl}/system/config/upload-logo`, { method: 'POST', headers: await t.loginAs({ userId: ids[who] }), body: form });
    return res.status;
  };
  const club = { clubName: 'Musikzug Beispielstadt', loginBanner: 'Willkommen!', loginAutoRedirect: true };
  const print = { browserPrintPageLimit: 7, publicBaseUrl: 'https://noten.example.org' };

  describe('permissions (S-4, R-4, F-1)', () => {
    it('reads with config.view, changes with config.edit', async () => {
      const matrix: Array<[Who | null, string, unknown, number]> = [
        [null, 'system/config', undefined, 401],
        ['mo', 'system/config', undefined, 403],
        ['vik', 'system/config', undefined, 200],
        ['eva', 'system/config', undefined, 200],
        ['vik', 'system/config/update-club', club, 403],
        ['mo', 'system/config/update-club', club, 403],
        ['vik', 'system/config/update-print', print, 403],
        ['vik', 'system/config/remove-logo', {}, 403],
        [null, 'system/config/update-club', club, 401],
      ];
      const failures: string[] = [];
      for (const [who, path, body, expected] of matrix) {
        const res = await api(who, path, body);
        if (res.status !== expected) failures.push(`${who} ${path}: ${res.status} (expected ${expected})`);
      }
      expect(failures).toEqual([]);
      expect((await api('eva', 'system/config')).body.club.clubName).toBe('Testverein');
      expect(await uploadLogo('vik', PNG)).toBe(403);
    });
  });

  describe('club data on the login page (S-4, F-12, A-2)', () => {
    it('shows the stored club data without a session', async () => {
      expect((await api(null, 'auth/login-page')).body).toEqual({
        clubName: 'Testverein',
        logoUrl: null,
        loginBanner: null,
        autoRedirect: false,
        ...legalLinks,
      });
    });

    it('shows changes right after they are saved', async () => {
      expect((await api('eva', 'system/config/update-club', club)).status).toBe(204);
      expect((await api('eva', 'system/config/update-print', print)).status).toBe(204);
      expect((await api('vik', 'system/config')).body).toMatchObject({
        club: { clubName: club.clubName, loginBanner: club.loginBanner, loginAutoRedirect: true, logoUrl: null },
        print: { browserPrintPageLimit: 7, publicBaseUrl: 'https://noten.example.org/' },
      });
      expect((await api(null, 'auth/login-page')).body).toMatchObject({ clubName: club.clubName, loginBanner: club.loginBanner, autoRedirect: true });
    });
  });

  describe('logo (S-4)', () => {
    it('serves the logo without a session, 404 while there is none', async () => {
      expect((await fetch(`${t.baseUrl}/auth/branding/logo`)).status).toBe(404);

      expect(await uploadLogo('eva', PNG)).toBe(204);
      const res = await fetch(`${t.baseUrl}/auth/branding/logo`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG);
      expect((await api(null, 'auth/login-page')).body.logoUrl).toBe('/internal/v1/auth/branding/logo');

      expect((await api('eva', 'system/config/remove-logo', {})).status).toBe(204);
      expect((await fetch(`${t.baseUrl}/auth/branding/logo`)).status).toBe(404);
      expect((await api(null, 'auth/login-page')).body.logoUrl).toBeNull();
    });
  });
});
