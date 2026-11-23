import { ALL_PERMISSIONS, permissionScope, type Permission } from '@vm-web/shared';
import { appendTo } from '../common/collections';

export interface MembershipRow {
  ensembleId: string;
  ensembleName: string;
  roleId: string;
  roleName: string;
  permissions: readonly Permission[];
}

export interface EnsembleNode {
  id: string;
  parentId: string | null;
  name: string;
}

export interface AccessInput {
  userId: string;
  isAdmin: boolean;
  memberships: readonly MembershipRow[];
  /** The whole ensemble tree (small; loaded per request). */
  ensembles: readonly EnsembleNode[];
}

const CLUB_PERMISSIONS = ALL_PERMISSIONS.filter((p) => permissionScope(p) === 'club');

/**
 * Effective permissions of one user (R-4, R-6, F-1, F-3):
 * - a role held in an ensemble applies there and in all descendants,
 * - club permissions from any role apply club-wide,
 * - `any-ensemble` permissions need the permission in at least one ensemble,
 * - the admin flag grants everything.
 */
export class AccessContext {
  readonly userId: string;
  readonly isAdmin: boolean;
  readonly memberships: readonly MembershipRow[];
  /** Effective permissions per ensemble, including inherited ones. */
  readonly byEnsemble: ReadonlyMap<string, ReadonlySet<Permission>>;
  readonly anyEnsemble: ReadonlySet<Permission>;
  readonly club: ReadonlySet<Permission>;
  private readonly ensembles: ReadonlyMap<string, EnsembleNode>;

  constructor(input: AccessInput) {
    this.userId = input.userId;
    this.isAdmin = input.isAdmin;
    this.memberships = input.memberships;
    this.ensembles = new Map(input.ensembles.map((e) => [e.id, e]));

    const children = new Map<string, string[]>();
    for (const e of input.ensembles) {
      if (e.parentId) appendTo(children, e.parentId, e.id);
    }

    const byEnsemble = new Map<string, Set<Permission>>();
    const anyEnsemble = new Set<Permission>();
    const club = new Set<Permission>();

    for (const m of input.memberships) {
      for (const p of m.permissions) {
        anyEnsemble.add(p);
        if (permissionScope(p) === 'club') club.add(p);
      }
      // the membership's ensemble and all its descendants
      const stack = [m.ensembleId];
      const seen = new Set<string>();
      while (stack.length) {
        const id = stack.pop() as string;
        if (seen.has(id)) continue;
        seen.add(id);
        const set = byEnsemble.get(id) ?? new Set<Permission>();
        m.permissions.forEach((p) => set.add(p));
        byEnsemble.set(id, set);
        stack.push(...(children.get(id) ?? []));
      }
    }

    if (this.isAdmin) {
      ALL_PERMISSIONS.forEach((p) => anyEnsemble.add(p));
      CLUB_PERMISSIONS.forEach((p) => club.add(p));
      for (const e of input.ensembles) byEnsemble.set(e.id, new Set(ALL_PERMISSIONS));
    }

    this.byEnsemble = byEnsemble;
    this.anyEnsemble = anyEnsemble;
    this.club = club;
  }

  /** `ensembleId` is required for permissions with scope `ensemble`. */
  has(permission: Permission, ensembleId?: string): boolean {
    if (this.isAdmin) return true;
    switch (permissionScope(permission)) {
      case 'club':
        return this.club.has(permission);
      case 'any-ensemble':
        return this.anyEnsemble.has(permission);
      case 'ensemble':
        return ensembleId !== undefined && (this.byEnsemble.get(ensembleId)?.has(permission) ?? false);
    }
  }

  /** Ensembles where the permission is effective – for filtering lists by `folder.view`, `event.view` … */
  ensemblesWith(permission: Permission): string[] {
    if (this.isAdmin) return [...this.ensembles.keys()];
    return [...this.byEnsemble].filter(([, set]) => set.has(permission)).map(([id]) => id);
  }

  /** Ensembles with direct membership plus all their descendants – the scope of Mein Bereich (R-2, H-1). */
  memberEnsembleIds(): string[] {
    return [...this.byEnsemble.keys()].filter((id) => !this.isAdmin || this.hasMembershipPath(id));
  }

  ensembleName(id: string): string | undefined {
    return this.ensembles.get(id)?.name;
  }

  private hasMembershipPath(id: string): boolean {
    const direct = new Set(this.memberships.map((m) => m.ensembleId));
    for (let cur: string | null | undefined = id; cur; cur = this.ensembles.get(cur)?.parentId) {
      if (direct.has(cur)) return true;
    }
    return false;
  }
}
