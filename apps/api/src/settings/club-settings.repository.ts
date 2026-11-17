import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database';
import { clubSettings } from '../db/schema';

export type ClubSettingsRow = typeof clubSettings.$inferSelect;

/** Read access to the single `club_settings` row (S-4). Created by the seed on first start. */
@Injectable()
export class ClubSettingsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async get(): Promise<ClubSettingsRow> {
    const [row] = await this.db.select().from(clubSettings).where(eq(clubSettings.id, 1));
    if (!row) throw new Error('club_settings missing – seed did not run');
    return row;
  }
}
