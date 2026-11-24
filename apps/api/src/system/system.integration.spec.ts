import { MulterModule } from '@nestjs/platform-express';
import { ALL_PERMISSIONS, CSRF_HEADER, LOGO_MAX_BYTES } from '@vm-web/shared';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { memberships, roles, userVoices, users } from '../db/schema';
import { lineupTemplateFile } from '../seed/defaults';
import { loadLineupTemplate } from '../seed/lineup-template';
import { SeedService } from '../seed/seed.service';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import { FILE_STORAGE } from '../storage/file-storage';
import { FsFileStorage } from '../storage/fs-file-storage';
import { LibraryBuilder } from '../testing/library-builder';
import { createTestApp, type TestApp } from '../testing/test-app';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import { ConfigService } from './config.service';
import { EnsemblesService } from './ensembles.service';
import { RolesService } from './roles.service';
import { SystemConfigController, SystemEnsemblesController, SystemRolesController, SystemUsersController } from './system.controller';
import { logoMulterOptions } from './system.module';
import { UsersService } from './users.service';
import { PrintRulesService } from '../print-rules/print-rules.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

/**
 * System administration (slice 7) against a real MySQL (TEST_DATABASE_URL).
 * Starts from the real first-start seed: root „Verein“, default roles, defaults root + admin.
 *
 * Tree: root ─┬─ orchestra ── windClass
 *             └─ youth
 */
describe.skipIf(!TEST_DATABASE_URL)('Systemverwaltung (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let t: TestApp;
  let storageDir: string;
  let storage: FsFileStorage;
  const ids = {} as Record<string, string>;

  beforeAll(async () => {
    testDb = await createTestDatabase('system');
    storageDir = await mkdtemp(join(tmpdir(), 'vmweb-sys-'));
    storage = new FsFileStorage(storageDir);
    await storage.init();
    const seed = new SeedService(testDb.db);
    await seed.runInitialSeed(join(__dirname, '../../defaults/roles.default.json'));

    const roleId = async (key: string) => (await testDb.db.select().from(roles).where(eq(roles.defaultKey, key)))[0].id;
    for (const key of ['admin', 'musician', 'librarian', 'board']) ids[`role_${key}`] = await roleId(key);

    const b = new LibraryBuilder(testDb.db);
    ids.root = (await testDb.db.query.ensembles.findFirst())?.id as string;
    ids.orchestra = await b.ensemble('Hauptorchester', ids.root);
    ids.windClass = await b.ensemble('Bläserklasse', ids.orchestra);
    ids.youth = await b.ensemble('Jugendorchester', ids.root);

    ids.adam = await b.user('Adam', { isAdmin: true });
    ids.sara = await b.user('Sara');
    ids.bob = await b.user('Bob');
    ids.mia = await b.user('Mia');
    await b.member(ids.sara, ids.youth, ids.role_admin); // club rights via a role in another ensemble (F-1)
    await b.member(ids.bob, ids.orchestra, ids.role_board);
    await b.member(ids.mia, ids.orchestra, ids.role_musician);
    const trumpet = await b.instrument('Trompete');
    ids.tp1 = await b.voice(trumpet, 'Trompete 1 in B');
    ids.tp2 = await b.voice(trumpet, 'Trompete 2 in B');

    t = await createTestApp(
      {
        imports: [MulterModule.registerAsync({ useFactory: logoMulterOptions })],
        controllers: [SystemUsersController, SystemEnsemblesController, SystemRolesController, SystemConfigController],
        providers: [UsersService, EnsemblesService, RolesService, ConfigService, ClubSettingsRepository, PrintRulesService],
      },
      { database: testDb.db, providers: [{ provide: FILE_STORAGE, useValue: storage }] },
    );
  });

  afterAll(async () => {
    await t?.close();
    await testDb?.close();
    if (storageDir) await rm(storageDir, { recursive: true, force: true });
  });

  type Who = 'adam' | 'sara' | 'bob' | 'mia';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = async (who: Who, path: string, body?: unknown): Promise<{ status: number; body: any }> => {
    const headers: Record<string, string> = await t.loginAs({ userId: ids[who] });
    const init: RequestInit = { headers };
    if (body !== undefined) {
      init.method = 'POST';
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${t.baseUrl}/system/${path}`, init);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  };
  const uploadLogo = async (who: Who, bytes: Buffer, name = 'logo.png') => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(bytes)]), name);
    const res = await fetch(`${t.baseUrl}/system/config/upload-logo`, { method: 'POST', headers: await t.loginAs({ userId: ids[who] }), body: form });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  };
  const names = (items: { name: string }[]) => items.map((i) => i.name);

  describe('permissions (R-4, R-6, F-1)', () => {
    const matrix = (): Array<[Who, string, unknown, number]> => [
      ['sara', 'user-table', undefined, 200],
      ['adam', 'user-table', undefined, 200],
      ['bob', 'user-table', undefined, 403],
      ['mia', 'user-table', undefined, 403],
      ['sara', 'user-assignment-options', undefined, 200],
      ['bob', 'user-assignment-options', undefined, 403],
      ['sara', `users/${ids.mia}/set-admin`, { isAdmin: true }, 403], // admin flag only (R-6)
      ['sara', 'ensemble-list', undefined, 200],
      ['bob', 'ensemble-list', undefined, 403],
      ['bob', `ensembles/${ids.orchestra}/details`, undefined, 200], // member.view (R-3)
      ['bob', `ensembles/${ids.orchestra}/members`, undefined, 200],
      ['bob', `ensembles/${ids.windClass}/members`, undefined, 200], // inherited (F-3)
      ['bob', `ensembles/${ids.youth}/members`, undefined, 404],
      ['mia', `ensembles/${ids.orchestra}/members`, undefined, 404],
      ['bob', `ensembles/${ids.orchestra}/lineup`, undefined, 403],
      ['bob', 'ensembles/create', { name: 'x', parentId: ids.root }, 403],
      ['sara', 'role-list', undefined, 200],
      ['mia', 'role-list', undefined, 403],
      ['bob', 'roles/create', { name: 'x' }, 403],
      ['sara', 'config', undefined, 200],
      ['bob', 'config', undefined, 403],
      ['mia', 'config/update-print', { browserPrintPageLimit: 5, publicBaseUrl: null }, 403],
    ];

    it('allows and forbids as expected', async () => {
      const failures: string[] = [];
      for (const [who, path, body, expected] of matrix()) {
        const res = await api(who, path, body);
        if (res.status !== expected) failures.push(`${who} ${path}: ${res.status} (expected ${expected})`);
      }
      expect(failures).toEqual([]);
    });
  });

  describe('users (S-1, A-5, R-1, R-6)', () => {
    it('lists users with memberships, voices and status; filters by ensemble, text and status', async () => {
      const all = (await api('sara', 'user-table')).body.items;
      expect(names(all)).toEqual(['Adam', 'Bob', 'Mia', 'Sara']);
      expect(all.find((u: { name: string }) => u.name === 'Mia')).toMatchObject({
        memberships: [{ ensemble: { id: ids.orchestra, name: 'Hauptorchester' }, role: { name: 'Musiker:in' } }],
        status: 'active',
        isAdmin: false,
      });
      expect(names((await api('sara', `user-table?ensembleId=${ids.orchestra}`)).body.items)).toEqual(['Bob', 'Mia']);
      expect(names((await api('sara', 'user-table?q=ADA')).body.items)).toEqual(['Adam']);
      const page = (await api('sara', 'user-table?limit=2')).body;
      expect(names((await api('sara', `user-table?limit=2&cursor=${page.nextCursor}`)).body.items)).toEqual(['Mia', 'Sara']);
    });

    it('assigns a role per ensemble (upsert) and removes memberships (R-1)', async () => {
      expect((await api('sara', `users/${ids.mia}/set-membership`, { ensembleId: ids.youth, roleId: ids.role_librarian })).status).toBe(204);
      expect((await api('sara', `users/${ids.mia}/set-membership`, { ensembleId: ids.youth, roleId: ids.role_board })).status).toBe(204);
      const details = (await api('sara', `users/${ids.mia}/details`)).body;
      expect(details.memberships.map((m: { ensemble: { name: string }; role: { name: string } }) => [m.ensemble.name, m.role.name])).toEqual([
        ['Hauptorchester', 'Musiker:in'],
        ['Jugendorchester', 'Vorstand'],
      ]);
      expect((await api('sara', `users/${ids.mia}/remove-membership`, { ensembleId: ids.youth })).status).toBe(204);
      expect((await api('sara', `users/${ids.mia}/remove-membership`, { ensembleId: ids.youth })).status).toBe(404);
      expect((await api('sara', `users/${ids.mia}/set-membership`, { ensembleId: ids.youth, roleId: ids.orchestra })).status).toBe(404);
    });

    it('pre-assigns profile voices (S-1)', async () => {
      expect((await api('sara', `users/${ids.mia}/set-voices`, { voiceIds: [ids.tp2, ids.tp1] })).status).toBe(204);
      expect((await api('sara', `users/${ids.mia}/details`)).body.voices.map((v: { id: string }) => v.id)).toEqual([ids.tp2, ids.tp1]);
      expect((await api('sara', `users/${ids.mia}/set-voices`, { voiceIds: [ids.youth] })).body.errors).toEqual([{ path: '/body/voiceIds/0', code: 'unknown_voice' }]);
    });

    it('blocks accounts immediately and protects oneself and the last admin (A-5)', async () => {
      expect((await api('sara', `users/${ids.mia}/block`, {})).status).toBe(204);
      const blocked = await api('mia', 'user-table');
      expect(blocked).toMatchObject({ status: 403, body: { code: 'account-blocked' } });
      expect((await api('sara', `users/${ids.mia}/unblock`, {})).status).toBe(204);
      expect((await api('mia', 'user-table')).body.code).toBe('forbidden');

      expect((await api('sara', `users/${ids.sara}/block`, {})).body.code).toBe('last-admin');
      expect((await api('sara', `users/${ids.adam}/block`, {})).body.code).toBe('last-admin');
      expect((await api('sara', `users/${ids.adam}/details`)).body.canBeDemoted).toBe(false);
    });

    it('lets only the admin flag change the admin flag, never for the last admin (R-6)', async () => {
      expect((await api('adam', `users/${ids.adam}/set-admin`, { isAdmin: false })).body.code).toBe('last-admin');
      expect((await api('adam', `users/${ids.sara}/set-admin`, { isAdmin: true })).status).toBe(204);
      expect((await api('adam', `users/${ids.adam}/set-admin`, { isAdmin: false })).status).toBe(204);
      expect((await api('sara', `users/${ids.adam}/set-admin`, { isAdmin: true })).status).toBe(204);
    });

    it('deletes accounts with their personal data (Datenschutz, F-15)', async () => {
      const b = new LibraryBuilder(testDb.db);
      const gone = await b.user('Gone');
      await b.member(gone, ids.orchestra, ids.role_musician);
      await b.profileVoices(gone, [ids.tp1]);
      expect((await api('sara', `users/${gone}/delete`, {})).status).toBe(204);
      expect(await testDb.db.select().from(users).where(eq(users.id, gone))).toEqual([]);
      expect(await testDb.db.select().from(memberships).where(eq(memberships.userId, gone))).toEqual([]);
      expect(await testDb.db.select().from(userVoices).where(eq(userVoices.userId, gone))).toEqual([]);
      expect((await api('sara', `users/${ids.sara}/delete`, {})).body.code).toBe('last-admin');
    });
  });

  describe('ensembles (S-2, F-3, N-4, N-8)', () => {
    it('lists the tree in pre-order with depth, default flag and counts; pages by position', async () => {
      const items = (await api('sara', 'ensemble-list')).body.items;
      expect(items.map((e: { name: string; depth: number }) => [e.name, e.depth])).toEqual([
        ['Verein', 0],
        ['Hauptorchester', 1],
        ['Bläserklasse', 2],
        ['Jugendorchester', 1],
      ]);
      expect(items[0]).toMatchObject({ isRoot: true, isDefault: true, parentId: null });
      expect(items[1]).toMatchObject({ memberCount: 2, lineupSize: 0 });
      const first = (await api('sara', 'ensemble-list?limit=3')).body;
      expect(names((await api('sara', `ensemble-list?limit=3&cursor=${first.nextCursor}`)).body.items)).toEqual(['Jugendorchester']);
    });

    it('creates sub-ensembles, optionally with the template lineup (N-8)', async () => {
      const template = await loadLineupTemplate(lineupTemplateFile());
      const lineupSize = template.instruments.flatMap((i) => i.voices).filter((v) => v.lineup).length;
      const created = await api('sara', 'ensembles/create', { name: 'Big Band', parentId: ids.root });
      expect(created.status).toBe(201);
      ids.bigBand = created.body.id;
      expect((await api('sara', `ensembles/${ids.bigBand}/details`)).body).toMatchObject({ lineupSize, depth: 1, archived: false });
      const bare = await api('sara', 'ensembles/create', { name: 'Kammermusik', parentId: ids.orchestra, applyLineupTemplate: false });
      ids.chamber = bare.body.id;
      expect((await api('sara', `ensembles/${ids.chamber}/lineup`)).body.voices).toEqual([]);
      expect((await api('sara', 'ensembles/create', { name: 'big band', parentId: ids.root })).body.code).toBe('name-taken');
      // same name under another parent is fine
      expect((await api('sara', 'ensembles/create', { name: 'Big Band', parentId: ids.youth, applyLineupTemplate: false })).status).toBe(201);
    });

    it('moves ensembles without cycles; the root stays put (F-3)', async () => {
      expect((await api('sara', `ensembles/${ids.root}/set-parent`, { parentId: ids.youth })).body.code).toBe('root-ensemble');
      expect((await api('sara', `ensembles/${ids.orchestra}/set-parent`, { parentId: ids.windClass })).body.code).toBe('invalid-hierarchy');
      expect((await api('sara', `ensembles/${ids.orchestra}/set-parent`, { parentId: ids.orchestra })).body.code).toBe('invalid-hierarchy');
      expect((await api('sara', `ensembles/${ids.chamber}/set-parent`, { parentId: ids.youth })).status).toBe(204);
      expect((await api('sara', `ensembles/${ids.chamber}/details`)).body.parentId).toBe(ids.youth);
    });

    it('archives only leaves that are not the default ensemble or root (S-2)', async () => {
      expect((await api('sara', `ensembles/${ids.root}/archive`, {})).body.code).toBe('root-ensemble');
      expect((await api('sara', `ensembles/${ids.orchestra}/archive`, {})).body.code).toBe('in-use'); // has windClass
      expect((await api('sara', `ensembles/${ids.chamber}/archive`, {})).status).toBe(204);
      expect(names((await api('sara', 'ensemble-list')).body.items)).not.toContain('Kammermusik');
      expect(names((await api('sara', 'ensemble-list?includeArchived=true')).body.items)).toContain('Kammermusik');
      expect((await api('sara', `users/${ids.mia}/set-membership`, { ensembleId: ids.chamber, roleId: ids.role_musician })).body.errors).toEqual([
        { path: '/body/ensembleId', code: 'archived' },
      ]);
      expect((await api('sara', `ensembles/${ids.chamber}/unarchive`, {})).status).toBe(204);
    });

    it('sets the lineup in order and re-applies the template (N-4, N-8)', async () => {
      expect((await api('sara', `ensembles/${ids.orchestra}/set-lineup`, { voiceIds: [ids.tp2, ids.tp1] })).status).toBe(204);
      expect((await api('sara', `ensembles/${ids.orchestra}/lineup`)).body.voices.map((v: { id: string }) => v.id)).toEqual([ids.tp2, ids.tp1]);
      expect((await api('sara', `ensembles/${ids.orchestra}/set-lineup`, { voiceIds: [ids.tp1, ids.tp1] })).body.errors).toEqual([
        { path: '/body/voiceIds/1', code: 'duplicate' },
      ]);
      const applied = await api('sara', `ensembles/${ids.orchestra}/apply-lineup-template`, {});
      expect(applied.status).toBe(200);
      expect(applied.body).toMatchObject({ createdInstruments: 0, createdVoices: 0 }); // template voices exist already (Big Band)
      expect((await api('sara', `ensembles/${ids.orchestra}/lineup`)).body.voices).toHaveLength(applied.body.lineupSize);
    });

    it('keeps print rules per ensemble, inherited by sub-ensembles (S-2, D-6, F-3)', async () => {
      // Without own rules: shipped default.
      expect((await api('sara', `ensembles/${ids.windClass}/print-rules`)).body).toEqual({
        rules: [
          { fromPages: 1, mode: 'simplex' },
          { fromPages: 2, mode: 'duplex' },
        ],
        own: false,
        inheritedFrom: null,
      });
      const rules = [
        { fromPages: 1, mode: 'simplex' },
        { fromPages: 4, mode: 'duplex' },
      ];
      expect((await api('sara', `ensembles/${ids.orchestra}/set-print-rules`, { rules })).status).toBe(204);
      expect((await api('sara', `ensembles/${ids.orchestra}/print-rules`)).body).toMatchObject({ rules, own: true, inheritedFrom: null });
      // The wind class sits below the orchestra and inherits its rules.
      expect((await api('sara', `ensembles/${ids.windClass}/print-rules`)).body).toMatchObject({ rules, own: false, inheritedFrom: { id: ids.orchestra } });
      // Incomplete or unordered rule sets are refused.
      expect((await api('sara', `ensembles/${ids.orchestra}/set-print-rules`, { rules: [{ fromPages: 2, mode: 'duplex' }] })).status).toBe(400);
      expect((await api('sara', `ensembles/${ids.orchestra}/reset-print-rules`, {})).status).toBe(204);
      expect((await api('sara', `ensembles/${ids.orchestra}/print-rules`)).body.own).toBe(false);
    });

    it('renames, also the root (H-4), with unique names among siblings', async () => {
      expect((await api('sara', `ensembles/${ids.root}/rename`, { name: 'Musikzug Beispielstadt' })).status).toBe(204);
      expect((await api('sara', `ensembles/${ids.youth}/rename`, { name: 'Hauptorchester' })).body.code).toBe('name-taken');
    });
  });

  describe('roles (S-3, R-3, R-5, R-7)', () => {
    it('lists default roles with markers and returns the matrix structure', async () => {
      const items = (await api('sara', 'role-list')).body.items;
      expect(names(items)).toEqual(['Administrator:in', 'Musiker:in', 'Notenwart:in', 'Vorstand']);
      expect(items[0]).toMatchObject({ defaultKey: 'admin', hasClubPermissions: true, modifiedFromDefault: false, assignmentCount: 1 });
      expect(items[1]).toMatchObject({ hasClubPermissions: false });
      const catalog = (await api('sara', 'permission-catalog')).body;
      expect(catalog.actions).toEqual(['view', 'create', 'edit', 'delete']);
      expect(catalog.areas.map((a: { area: string }) => a.area)).toEqual(['score', 'voice', 'tag', 'folder', 'event', 'user', 'role', 'ensemble']);
      expect([...catalog.areas.flatMap((a: { permissions: string[] }) => a.permissions), ...catalog.singles.map((s: { permission: string }) => s.permission)].sort()).toEqual(
        [...ALL_PERMISSIONS].sort(),
      );
    });

    it('creates, renames and edits roles; detects changes against the defaults', async () => {
      const created = await api('sara', 'roles/create', { name: 'Registerführung', permissions: ['member.view'] });
      expect(created.status).toBe(201);
      ids.customRole = created.body.id;
      expect((await api('sara', 'roles/create', { name: 'registerführung' })).body.code).toBe('name-taken');
      expect((await api('sara', `roles/${ids.customRole}/set-permissions`, { permissions: ['score.view', 'member.view', 'score.view'] })).status).toBe(204);
      expect((await api('sara', `roles/${ids.customRole}/details`)).body).toMatchObject({ defaultKey: null, permissions: ['score.view', 'member.view'] });

      expect((await api('sara', `roles/${ids.role_librarian}/set-permissions`, { permissions: ['score.view'] })).status).toBe(204);
      expect((await api('sara', `roles/${ids.role_librarian}/details`)).body.modifiedFromDefault).toBe(true);
      expect((await api('sara', `roles/${ids.role_librarian}/reset-to-default`, {})).status).toBe(204);
      expect((await api('sara', `roles/${ids.role_librarian}/details`)).body).toMatchObject({ modifiedFromDefault: false, permissions: expect.arrayContaining(['sheet.approve']) });
      expect((await api('sara', `roles/${ids.customRole}/reset-to-default`, {})).body.code).toBe('not-default-role');
    });

    it('refuses deleting the admin role, assigned roles and the default role', async () => {
      expect((await api('sara', `roles/${ids.role_admin}/delete`, {})).body.code).toBe('in-use');
      expect((await api('sara', `roles/${ids.role_musician}/delete`, {})).body.code).toBe('in-use'); // Mia
      expect((await api('sara', `roles/${ids.customRole}/delete`, {})).status).toBe(204);
    });

    it('re-creates deleted default roles and resets the others (R-5)', async () => {
      expect((await api('sara', `roles/${ids.role_librarian}/delete`, {})).status).toBe(204);
      await api('sara', `roles/${ids.role_board}/rename`, { name: 'Vorstandschaft' });
      expect((await api('sara', 'roles/reset-defaults', {})).body).toEqual({ reset: 3, recreated: 1 });
      expect(names((await api('sara', 'role-list')).body.items)).toEqual(['Administrator:in', 'Musiker:in', 'Notenwart:in', 'Vorstand']);
    });
  });

  describe('configuration (S-4, B-1)', () => {
    it('warns while the default role has club permissions (B-1)', async () => {
      const before = (await api('sara', 'config')).body;
      expect(before.defaults).toEqual({ defaultEnsemble: { id: ids.root, name: 'Musikzug Beispielstadt' }, defaultRole: { id: ids.role_admin, name: 'Administrator:in' } });
      expect(before.warnings).toEqual(['default-role-has-club-permissions']);
      const options = (await api('sara', 'config/default-options')).body;
      expect(options.roles.find((r: { id: string }) => r.id === ids.role_admin).hasClubPermissions).toBe(true);

      expect((await api('sara', 'config/update-defaults', { defaultEnsembleId: ids.orchestra, defaultRoleId: ids.role_musician })).status).toBe(204);
      expect((await api('sara', 'config')).body.warnings).toEqual([]);
      expect((await api('sara', `ensembles/${ids.orchestra}/archive`, {})).body.code).toBe('in-use');
    });

    it('stores club data, links and print settings', async () => {
      expect(
        (
          await api('sara', 'config/update-club', {
            clubName: 'Musikzug Beispielstadt',
            imprintUrl: 'https://example.org/impressum',
            privacyUrl: null,
            loginBanner: 'Willkommen!',
            loginAutoRedirect: true,
          })
        ).status,
      ).toBe(204);
      expect((await api('sara', 'config/update-print', { browserPrintPageLimit: 12, publicBaseUrl: 'https://noten.example.org' })).status).toBe(204);
      expect((await api('sara', 'config/update-club', { clubName: '', imprintUrl: 'javascript:x', privacyUrl: null, loginBanner: null, loginAutoRedirect: false })).status).toBe(400);
      const config = (await api('sara', 'config')).body;
      expect(config.club).toMatchObject({ clubName: 'Musikzug Beispielstadt', imprintUrl: 'https://example.org/impressum', loginBanner: 'Willkommen!', loginAutoRedirect: true });
      expect(config.print).toEqual({ browserPrintPageLimit: 12, publicBaseUrl: 'https://noten.example.org/' });
    });

    it('uploads, replaces and removes the logo; only images, max. 2 MB', async () => {
      expect((await uploadLogo('sara', PNG)).status).toBe(204);
      const first = (await testDb.db.query.clubSettings.findFirst())?.logoFileKey as string;
      expect(await storage.stat(first)).not.toBeNull();
      expect((await api('sara', 'config')).body.club.logoUrl).toBe('/internal/v1/auth/branding/logo');

      expect((await uploadLogo('sara', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'logo.svg')).status).toBe(204);
      const second = await testDb.db.query.clubSettings.findFirst();
      expect(second?.logoMime).toBe('image/svg+xml');
      expect(await storage.stat(first)).toBeNull();

      expect((await uploadLogo('sara', Buffer.from('%PDF-1.7'), 'logo.pdf')).body).toMatchObject({ status: 415, errors: [{ path: '/file', code: 'not_image' }] });
      expect((await uploadLogo('sara', Buffer.concat([PNG, Buffer.alloc(LOGO_MAX_BYTES)]))).status).toBe(413);
      expect((await uploadLogo('mia', PNG)).status).toBe(403);

      expect((await api('sara', 'config/remove-logo', {})).status).toBe(204);
      expect((await api('sara', 'config')).body.club.logoUrl).toBeNull();
      expect(await storage.stat(second?.logoFileKey as string)).toBeNull();
    });
  });

  it('requires the CSRF token for system actions', async () => {
    const headers = await t.loginAs({ userId: ids.sara });
    delete headers[CSRF_HEADER];
    const res = await fetch(`${t.baseUrl}/system/roles/reset-defaults`, { method: 'POST', headers });
    expect(res.status).toBe(403);
  });
});
