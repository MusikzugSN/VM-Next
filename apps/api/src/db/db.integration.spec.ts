import { ALL_PERMISSIONS } from '@vm-web/shared';
import { eq } from 'drizzle-orm';
import { join } from 'node:path';
import { AccessContext } from '../access/access-context';
import { AccessRepository } from '../access/access.repository';
import type { IdentityClaims } from '../auth/oidc.client';
import { UsersRepository } from '../auth/users.repository';
import { SeedService } from '../seed/seed.service';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../testing/test-database';
import type { Database } from './database';
import * as schema from './schema';

/**
 * Runs against a real PostgreSQL when TEST_DATABASE_URL is set (see apps/api/README.md).
 * Uses its own freshly created database `<name>_auth`.
 */
const ROLES_FILE = join(__dirname, '../../defaults/roles.default.json');

const claims = (sub: string, extra: Partial<IdentityClaims> = {}): IdentityClaims => ({
  sub,
  name: `Name ${sub}`,
  email: `${sub}@example.org`,
  picture: null,
  idToken: null,
  ...extra,
});

describe.skipIf(!TEST_DATABASE_URL)('database integration: auth and seed (TEST_DATABASE_URL)', () => {
  let testDb: TestDatabase;
  let db: Database;
  let seed: SeedService;
  let usersRepo: UsersRepository;
  let accessRepo: AccessRepository;

  beforeAll(async () => {
    testDb = await createTestDatabase('auth');
    db = testDb.db;
    seed = new SeedService(db);
    usersRepo = new UsersRepository(db);
    accessRepo = new AccessRepository(db);
  });

  afterAll(async () => {
    await testDb?.close();
  });

  it('seeds roles, root ensemble and settings once (R-5, S-5, H-3, H-4)', async () => {
    expect(await seed.runInitialSeed(ROLES_FILE)).toBe(true);
    expect(await seed.runInitialSeed(ROLES_FILE)).toBe(false);

    const roles = await db.select().from(schema.roles);
    expect(roles.map((r) => r.defaultKey).sort()).toEqual(['admin', 'board', 'librarian', 'musician']);
    const [admin] = roles.filter((r) => r.defaultKey === 'admin');
    const adminPermissions = await db.select().from(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, admin.id));
    expect(adminPermissions).toHaveLength(ALL_PERMISSIONS.length);

    const [root] = await db.select().from(schema.ensembles);
    expect(root).toMatchObject({ name: 'Verein', isRoot: true, parentId: null });

    const [settings] = await db.select().from(schema.clubSettings);
    expect(settings).toMatchObject({ clubName: 'Verein', defaultEnsembleId: root.id, defaultRoleId: admin.id, browserPrintPageLimit: 10 });
  });

  it('rejects a second root and unknown permission codes at database level', async () => {
    await expect(db.insert(schema.ensembles).values({ id: crypto.randomUUID(), name: 'Zweite Wurzel', isRoot: true })).rejects.toThrow();
    const [role] = await db.select().from(schema.roles).limit(1);
    await expect(db.insert(schema.rolePermissions).values({ roleId: role.id, permission: 'folder.publish' })).rejects.toThrow();
  });

  it('makes exactly one person admin when the first logins race (S-5)', async () => {
    const results = await Promise.all(['first-a', 'first-b', 'first-c'].map((s) => usersRepo.upsertOnLogin(claims(s), new Date())));
    expect(results.filter((r) => r.isAdmin)).toHaveLength(1);
    expect(results.every((r) => r.created)).toBe(true);
  });

  it('gives the first person the admin role in the root ensemble and the admin flag (H-2)', async () => {
    const [first] = await db.select().from(schema.users).where(eq(schema.users.isAdmin, true));
    const user = await accessRepo.loadUser(first.id);
    if (!user) throw new Error('missing');
    const access = new AccessContext(await accessRepo.loadAccessInput(user));
    expect(access.memberships).toEqual([
      expect.objectContaining({ ensembleName: 'Verein', roleName: 'Administrator:in', permissions: expect.arrayContaining(['config.edit']) }),
    ]);
  });

  it('puts new accounts into the default ensemble with the default role (A-3, H-3)', async () => {
    const created = await usersRepo.upsertOnLogin(claims('later'), new Date());
    expect(created).toMatchObject({ created: true, isAdmin: false });
    const user = await accessRepo.loadUser(created.id);
    if (!user) throw new Error('missing');
    const access = new AccessContext(await accessRepo.loadAccessInput(user));
    // ab Werk: root + admin → full rights via the role, but no admin flag (B-1 warns about this)
    expect(access.isAdmin).toBe(false);
    expect(access.has('user.edit')).toBe(true);
  });

  it('creates accounts without membership when no defaults are configured', async () => {
    await db.update(schema.clubSettings).set({ defaultRoleId: null });
    const created = await usersRepo.upsertOnLogin(claims('no-defaults'), new Date());
    const user = await accessRepo.loadUser(created.id);
    if (!user) throw new Error('missing');
    expect((await accessRepo.loadAccessInput(user)).memberships).toEqual([]);
  });

  it('updates name, e-mail and picture on every login, matched by sub (A-4)', async () => {
    const before = await usersRepo.upsertOnLogin(claims('later'), new Date());
    const after = await usersRepo.upsertOnLogin(
      claims('later', { name: 'Neuer Name', email: 'neu@example.org', picture: 'https://id.example.org/p.png' }),
      new Date(),
    );
    expect(after).toMatchObject({ id: before.id, created: false });
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, before.id));
    expect(row).toMatchObject({ name: 'Neuer Name', email: 'neu@example.org', pictureUrl: 'https://id.example.org/p.png' });
  });

  it('reports blocked accounts at login (A-5)', async () => {
    const user = await usersRepo.upsertOnLogin(claims('to-block'), new Date());
    await db.update(schema.users).set({ status: 'blocked' }).where(eq(schema.users.id, user.id));
    expect(await usersRepo.upsertOnLogin(claims('to-block'), new Date())).toMatchObject({ status: 'blocked' });
  });

  it('falls back to e-mail or sub as name', async () => {
    const created = await usersRepo.upsertOnLogin(claims('nameless', { name: null, email: null }), new Date());
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, created.id));
    expect(row.name).toBe('nameless');
  });
});
