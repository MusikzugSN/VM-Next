import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { uuidv7 } from '../common/ids/uuid-v7';
import { DATABASE, type Database } from '../db/database';
import { clubSettings, ensembles, memberships, roles, users } from '../db/schema';
import type { IdentityClaims } from './oidc.client';

export interface LoginUser {
  id: string;
  status: 'active' | 'blocked';
  created: boolean;
  isAdmin: boolean;
}

/** Serializes logins so that exactly one person becomes the first admin (S-5). */
const FIRST_USER_LOCK = 0x766d7765; // "vmwe"

export const USERS_REPOSITORY = Symbol('UsersRepository');

export interface IUsersRepository {
  upsertOnLogin(claims: IdentityClaims, now: Date): Promise<LoginUser>;
}

/** Account handling at login (A-3, A-4, S-5, H-2, H-3). */
@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async upsertOnLogin(claims: IdentityClaims, now: Date): Promise<LoginUser> {
    const profile = {
      name: claims.name ?? claims.email ?? claims.sub,
      email: claims.email,
      pictureUrl: claims.picture,
    };

    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${FIRST_USER_LOCK})`);

      const [existing] = await tx
        .update(users)
        .set({ ...profile, lastLoginAt: now, updatedAt: now })
        .where(eq(users.oidcSub, claims.sub))
        .returning({ id: users.id, status: users.status, isAdmin: users.isAdmin });
      if (existing) return { ...existing, created: false };

      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(users);
      const isFirst = count === 0;
      const id = uuidv7();
      await tx.insert(users).values({
        id,
        oidcSub: claims.sub,
        ...profile,
        isAdmin: isFirst,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const target = isFirst ? await this.rootAdminTarget(tx) : await this.defaultTarget(tx);
      if (target) await tx.insert(memberships).values({ userId: id, ...target, createdAt: now });

      return { id, status: 'active', created: true, isAdmin: isFirst };
    });
  }

  /** Standard ensemble and role for new accounts (A-3); ab Werk root + admin (H-3). */
  private async defaultTarget(tx: Tx): Promise<{ ensembleId: string; roleId: string } | null> {
    const [row] = await tx
      .select({ ensembleId: clubSettings.defaultEnsembleId, roleId: clubSettings.defaultRoleId })
      .from(clubSettings)
      .innerJoin(ensembles, eq(ensembles.id, clubSettings.defaultEnsembleId))
      .where(and(eq(clubSettings.id, 1), isNull(ensembles.archivedAt)));
    return row?.ensembleId && row.roleId ? { ensembleId: row.ensembleId, roleId: row.roleId } : null;
  }

  /** The first person always gets the admin role in the root ensemble (H-2), whatever the defaults say. */
  private async rootAdminTarget(tx: Tx): Promise<{ ensembleId: string; roleId: string } | null> {
    const [root] = await tx.select({ id: ensembles.id }).from(ensembles).where(eq(ensembles.isRoot, true));
    const [admin] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.defaultKey, 'admin'));
    return root && admin ? { ensembleId: root.id, roleId: admin.id } : null;
  }
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
