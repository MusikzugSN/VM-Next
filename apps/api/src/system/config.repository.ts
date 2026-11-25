import { Inject, Injectable } from '@nestjs/common';
import type { EnsembleOption } from '@vm-web/shared';
import { eq, inArray } from 'drizzle-orm';
import { activeEnsembleOptions } from '../common/ensemble-tree';
import { DATABASE, type Database } from '../db/database';
import { clubSettings, ensembles, rolePermissions, roles } from '../db/schema';
import { roleOptions } from '../library/library-helpers';
import { lockClubSettings } from './club-settings-lock';

export type ClubSettingsUpdate = Partial<typeof clubSettings.$inferInsert>;

export interface DefaultsState {
  ensemble: { archivedAt: Date | null } | undefined;
  roleExists: boolean;
}

@Injectable()
export class ConfigRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async ensembleRef(ensembleId: string): Promise<{ id: string; name: string } | undefined> {
    const [row] = await this.db.select({ id: ensembles.id, name: ensembles.name }).from(ensembles).where(eq(ensembles.id, ensembleId));
    return row;
  }

  async roleRef(roleId: string): Promise<{ id: string; name: string } | undefined> {
    const [row] = await this.db.select({ id: roles.id, name: roles.name }).from(roles).where(eq(roles.id, roleId));
    return row;
  }

  activeEnsembleOptions(): Promise<EnsembleOption[]> {
    return activeEnsembleOptions(this.db);
  }

  roleOptions(): Promise<{ id: string; name: string }[]> {
    return roleOptions(this.db);
  }

  async permissionsOf(roleIds: readonly string[]): Promise<{ roleId: string; permission: string }[]> {
    if (!roleIds.length) return [];
    return this.db.select().from(rolePermissions).where(inArray(rolePermissions.roleId, [...roleIds]));
  }

  async update(set: ClubSettingsUpdate): Promise<void> {
    await this.db.update(clubSettings).set({ ...set, updatedAt: new Date() }).where(eq(clubSettings.id, 1));
  }

  updateDefaults(defaultEnsembleId: string | null, defaultRoleId: string | null, check: (state: DefaultsState) => void): Promise<void> {
    return this.db.transaction(async (tx) => {
      await lockClubSettings(tx);
      const [ensemble] = defaultEnsembleId
        ? await tx.select({ archivedAt: ensembles.archivedAt }).from(ensembles).where(eq(ensembles.id, defaultEnsembleId)).for('share')
        : [];
      const [role] = defaultRoleId ? await tx.select({ id: roles.id }).from(roles).where(eq(roles.id, defaultRoleId)).for('share') : [];
      check({ ensemble, roleExists: !!role });
      await tx.update(clubSettings).set({ defaultEnsembleId, defaultRoleId, updatedAt: new Date() }).where(eq(clubSettings.id, 1));
    });
  }
}
