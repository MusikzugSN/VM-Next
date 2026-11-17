import { Inject, Injectable } from '@nestjs/common';
import type { Permission } from '@vm-web/shared';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database';
import { ensembles, memberships, rolePermissions, roles, users } from '../db/schema';
import type { AccessInput, MembershipRow } from './access-context';

export interface AccessUser {
  id: string;
  name: string;
  email: string | null;
  pictureUrl: string | null;
  isAdmin: boolean;
  status: 'active' | 'blocked';
}

/** Loads everything needed to evaluate permissions for one user (3 small queries). */
@Injectable()
export class AccessRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async loadUser(userId: string): Promise<AccessUser | undefined> {
    const [user] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        pictureUrl: users.pictureUrl,
        isAdmin: users.isAdmin,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, userId));
    return user;
  }

  async loadAccessInput(user: AccessUser): Promise<AccessInput> {
    const [rows, tree] = await Promise.all([
      this.db
        .select({
          ensembleId: memberships.ensembleId,
          ensembleName: ensembles.name,
          roleId: roles.id,
          roleName: roles.name,
          permission: rolePermissions.permission,
        })
        .from(memberships)
        .innerJoin(ensembles, eq(ensembles.id, memberships.ensembleId))
        .innerJoin(roles, eq(roles.id, memberships.roleId))
        .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
        .where(eq(memberships.userId, user.id)),
      this.db.select({ id: ensembles.id, parentId: ensembles.parentId, name: ensembles.name }).from(ensembles),
    ]);

    const byEnsemble = new Map<string, MembershipRow & { permissions: Permission[] }>();
    for (const r of rows) {
      const m = byEnsemble.get(r.ensembleId) ?? {
        ensembleId: r.ensembleId,
        ensembleName: r.ensembleName,
        roleId: r.roleId,
        roleName: r.roleName,
        permissions: [],
      };
      if (r.permission) m.permissions.push(r.permission as Permission);
      byEnsemble.set(r.ensembleId, m);
    }

    return { userId: user.id, isAdmin: user.isAdmin, memberships: [...byEnsemble.values()], ensembles: tree };
  }
}
