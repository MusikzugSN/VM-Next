import type { Permission } from '@vm-web/shared';
import { expandPermissions } from '../seed/default-roles';
import type { AccessInput, EnsembleNode, MembershipRow } from '../access/access-context';
import type { AccessUser } from '../access/access.repository';
import { AccessContext } from '../access/access-context';

/**
 * Test tree (F-3):
 *   root (Verein)
 *   ├── orchestra (Hauptorchester)
 *   │   └── wind-class (Bläserklasse)
 *   └── youth (Jugendorchester)
 */
export const ENS = {
  root: '00000000-0000-7000-8000-000000000001',
  orchestra: '00000000-0000-7000-8000-000000000002',
  windClass: '00000000-0000-7000-8000-000000000003',
  youth: '00000000-0000-7000-8000-000000000004',
} as const;

export const ENSEMBLES: EnsembleNode[] = [
  { id: ENS.root, parentId: null, name: 'Verein' },
  { id: ENS.orchestra, parentId: ENS.root, name: 'Hauptorchester' },
  { id: ENS.windClass, parentId: ENS.orchestra, name: 'Bläserklasse' },
  { id: ENS.youth, parentId: ENS.root, name: 'Jugendorchester' },
];

const ROLE_PERMISSIONS = {
  musician: expandPermissions(['sheet.upload']),
  librarian: expandPermissions(['score.*', 'voice.*', 'folder.*', 'event.*', 'tag.*', 'sheet.upload', 'sheet.approve', 'member.view']),
  board: expandPermissions(['member.view', 'event.*']),
  admin: expandPermissions(['*']),
  viewer: expandPermissions(['folder.view', 'score.view']),
  empty: [] as Permission[],
};
type RoleKey = keyof typeof ROLE_PERMISSIONS;

/** Stable UUIDs per role key, e.g. admin → 30000000-0000-7000-8000-000000000004. */
export const roleIdOf = (role: RoleKey) =>
  `30000000-0000-7000-8000-${String(Object.keys(ROLE_PERMISSIONS).indexOf(role) + 1).padStart(12, '0')}`;

const membership = (ensembleId: string, role: RoleKey): MembershipRow => ({
  ensembleId,
  ensembleName: ENSEMBLES.find((e) => e.id === ensembleId)?.name ?? '?',
  roleId: roleIdOf(role),
  roleName: role,
  permissions: ROLE_PERMISSIONS[role],
});

interface Person {
  user: AccessUser;
  memberships: MembershipRow[];
}

const person = (n: number, name: string, memberships: MembershipRow[], extra: Partial<AccessUser> = {}): Person => ({
  user: {
    id: `10000000-0000-7000-8000-${String(n).padStart(12, '0')}`,
    name,
    email: `${name}@example.org`,
    pictureUrl: null,
    isAdmin: false,
    status: 'active',
    ...extra,
  },
  memberships,
});

/** People used by the permission tests. */
export const PEOPLE = {
  /** Member of the orchestra with the musician role (sheet.upload only). */
  musician: person(1, 'musician', [membership(ENS.orchestra, 'musician')]),
  /** Librarian of the orchestra – inherits to the wind class, not to youth. */
  orchestraLibrarian: person(2, 'librarian', [membership(ENS.orchestra, 'librarian')]),
  /** Board of the youth orchestra (events, members). */
  youthBoard: person(3, 'board', [membership(ENS.youth, 'board')]),
  /** Admin role held in the youth orchestra – its club permissions apply club-wide (F-1). */
  youthAdminRole: person(4, 'admin-role', [membership(ENS.youth, 'admin')]),
  /** Admin flag without any membership (R-6). */
  adminFlag: person(5, 'admin-flag', [], { isAdmin: true }),
  /** Member with a role without permissions. */
  plainMember: person(6, 'plain', [membership(ENS.youth, 'empty')]),
  /** Librarian at the root – applies in every ensemble (F-3). */
  rootLibrarian: person(7, 'root-librarian', [membership(ENS.root, 'librarian')]),
  /** May see but not change folders of the orchestra. */
  orchestraViewer: person(10, 'viewer', [membership(ENS.orchestra, 'viewer')]),
  /** Account without membership. */
  noMembership: person(8, 'nobody', []),
  /** Blocked account (A-5). */
  blocked: person(9, 'blocked', [membership(ENS.orchestra, 'librarian')], { status: 'blocked' }),
} satisfies Record<string, Person>;

export type PersonKey = keyof typeof PEOPLE;

export function accessInputOf(p: Person): AccessInput {
  return { userId: p.user.id, isAdmin: p.user.isAdmin, memberships: p.memberships, ensembles: ENSEMBLES };
}

export function accessOf(key: PersonKey): AccessContext {
  return new AccessContext(accessInputOf(PEOPLE[key]));
}

/** In-memory replacement for `AccessRepository`. */
export class FakeAccessRepository {
  async loadUser(userId: string): Promise<AccessUser | undefined> {
    return Object.values(PEOPLE).find((p) => p.user.id === userId)?.user;
  }

  async loadAccessInput(user: AccessUser): Promise<AccessInput> {
    const p = Object.values(PEOPLE).find((x) => x.user.id === user.id);
    if (!p) throw new Error(`unknown test user ${user.id}`);
    return accessInputOf(p);
  }
}

/** `AppConfig` stub with the values the access layer reads. */
export function fakeConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'http://localhost:4200',
    SESSION_IDLE_TTL_DAYS: 14,
    SESSION_ABSOLUTE_TTL_DAYS: 90,
    ...overrides,
  };
  return { get: (key: string) => values[key], isProduction: false };
}
