import { eq } from 'drizzle-orm';
import type { Tx } from '../db/database';
import { clubSettings } from '../db/schema';

export type LockedClubSettings = typeof clubSettings.$inferSelect;

export async function lockClubSettings(tx: Tx): Promise<LockedClubSettings> {
  const [row] = await tx.select().from(clubSettings).where(eq(clubSettings.id, 1)).for('update');
  if (!row) throw new Error('club_settings missing – seed did not run');
  return row;
}
