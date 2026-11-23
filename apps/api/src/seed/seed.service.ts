import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { lineupTemplateFile, rolesFile } from './defaults';
import { uuidv7 } from '../common/ids/uuid-v7';
import { DATABASE, type Database, type Tx } from '../db/database';
import { clubSettings, ensembles, rolePermissions, roles, systemState } from '../db/schema';
import { loadDefaultRoles, type DefaultRole } from './default-roles';
import { importLineupTemplate, loadLineupTemplate } from './lineup-template';

export const INITIAL_SEED_KEY = 'seed.initial';
export const LINEUP_SEED_KEY = 'seed.lineup-template';
export const ROOT_ENSEMBLE_NAME = 'Verein';
const SEED_LOCK = 0x76736564; // "vsed"

/**
 * First start without setup wizard (S-5, R-5, F-3, H-3, H-4):
 * imports the default roles, creates the root ensemble and the club settings with
 * root + `admin` as defaults for new accounts. Runs once; guarded by `system_state`.
 * The lineup template (N-8) is imported separately, see `runLineupTemplateSeed`.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Seed');

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.runInitialSeed(rolesFile());
    await this.runLineupTemplateSeed(lineupTemplateFile());
  }

  /**
   * Imports instruments, voices and substitutes of the lineup template once (N-8, S-5).
   * Separate from the initial seed so that existing installations get it too.
   */
  async runLineupTemplateSeed(templateFile: string): Promise<boolean> {
    const template = await loadLineupTemplate(templateFile);
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${SEED_LOCK})`);
      const [done] = await tx.select().from(systemState).where(eq(systemState.key, LINEUP_SEED_KEY));
      if (done) return false;
      const result = await importLineupTemplate(tx, template);
      await tx.insert(systemState).values({
        key: LINEUP_SEED_KEY,
        value: { version: template.version, name: template.name, at: new Date().toISOString() },
      });
      this.logger.log(
        `Lineup template "${template.name}": ${result.createdInstruments} instruments, ${result.createdVoices} voices created`,
      );
      return true;
    });
  }

  /** @returns whether the seed ran (false if it had already run). */
  async runInitialSeed(rolesFile: string): Promise<boolean> {
    const defaults = await loadDefaultRoles(rolesFile);
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${SEED_LOCK})`);
      const [done] = await tx.select().from(systemState).where(eq(systemState.key, INITIAL_SEED_KEY));
      if (done) return false;

      const now = new Date();
      const roleIds = new Map<string, string>();
      for (const role of defaults.roles) roleIds.set(role.key, await insertRole(tx, role, now));

      const rootId = uuidv7();
      await tx.insert(ensembles).values({ id: rootId, name: ROOT_ENSEMBLE_NAME, isRoot: true, createdAt: now, updatedAt: now });

      await tx.insert(clubSettings).values({
        id: 1,
        clubName: ROOT_ENSEMBLE_NAME,
        defaultEnsembleId: rootId,
        defaultRoleId: roleIds.get('admin'),
        updatedAt: now,
      });

      await tx.insert(systemState).values({
        key: INITIAL_SEED_KEY,
        value: { rolesVersion: defaults.version, at: now.toISOString() },
        updatedAt: now,
      });
      this.logger.log(`First start: imported ${defaults.roles.length} default roles, created root ensemble`);
      return true;
    });
  }
}


async function insertRole(tx: Tx, role: DefaultRole, now: Date): Promise<string> {
  const id = uuidv7();
  await tx.insert(roles).values({ id, defaultKey: role.key, name: role.name, createdAt: now, updatedAt: now });
  if (role.permissions.length) {
    await tx.insert(rolePermissions).values(role.permissions.map((permission) => ({ roleId: id, permission })));
  }
  return id;
}
