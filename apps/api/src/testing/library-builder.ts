import type { Permission } from '@vm-web/shared';
import { naturalSortKey } from '../common/natural-sort';
import { uuidv7 } from '../common/ids/uuid-v7';
import type { Database } from '../db/database';
import {
  clubSettings,
  clubTags,
  ensembleLineupVoices,
  ensembles,
  events,
  folderEntries,
  folders,
  instruments,
  memberships,
  rolePermissions,
  roles,
  scoreClubTags,
  scores,
  setlistEntries,
  sheets,
  userVoices,
  users,
  voices,
  voiceSubstitutes,
} from '../db/schema';

/** Inserts test data with readable calls; every method returns the new id. */
export class LibraryBuilder {
  private position = 0;

  constructor(private readonly db: Database) {}

  async ensemble(name: string, parentId: string | null, opts: { archived?: boolean } = {}): Promise<string> {
    const id = uuidv7();
    await this.db.insert(ensembles).values({
      id,
      name,
      parentId,
      isRoot: parentId === null,
      archivedAt: opts.archived ? new Date() : null,
    });
    return id;
  }

  async role(name: string, permissions: Permission[] = []): Promise<string> {
    const id = uuidv7();
    await this.db.insert(roles).values({ id, name });
    if (permissions.length) await this.db.insert(rolePermissions).values(permissions.map((permission) => ({ roleId: id, permission })));
    return id;
  }

  async user(name: string, opts: { isAdmin?: boolean; blocked?: boolean } = {}): Promise<string> {
    const id = uuidv7();
    await this.db.insert(users).values({
      id,
      oidcSub: `sub-${id}`,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.org`,
      isAdmin: opts.isAdmin ?? false,
      status: opts.blocked ? 'blocked' : 'active',
    });
    return id;
  }

  async member(userId: string, ensembleId: string, roleId: string): Promise<void> {
    await this.db.insert(memberships).values({ userId, ensembleId, roleId });
  }

  async instrument(name: string): Promise<string> {
    const id = uuidv7();
    await this.db.insert(instruments).values({ id, name, position: this.position++ });
    return id;
  }

  async voice(instrumentId: string, name: string): Promise<string> {
    const id = uuidv7();
    await this.db.insert(voices).values({ id, instrumentId, name, position: this.position++ });
    return id;
  }

  async substitutes(voiceId: string, substituteIds: string[]): Promise<void> {
    await this.db
      .insert(voiceSubstitutes)
      .values(substituteIds.map((substituteVoiceId, position) => ({ voiceId, substituteVoiceId, position })));
  }

  async profileVoices(userId: string, voiceIds: string[]): Promise<void> {
    await this.db.insert(userVoices).values(voiceIds.map((voiceId, position) => ({ userId, voiceId, position })));
  }

  async score(title: string, composer: string | null = null): Promise<string> {
    const id = uuidv7();
    await this.db.insert(scores).values({ id, title, composer });
    return id;
  }

  async sheet(scoreId: string, voiceId: string, pageCount = 2): Promise<string> {
    const id = uuidv7();
    await this.db.insert(sheets).values({ id, scoreId, voiceId, pageCount, fileKey: `sheets/${id}.pdf`, sizeBytes: 1000 });
    return id;
  }

  async folder(ensembleId: string, name: string, showInMyArea = true): Promise<string> {
    const id = uuidv7();
    await this.db.insert(folders).values({ id, ensembleId, name, showInMyArea });
    return id;
  }

  async inFolder(folderId: string, entries: [scoreId: string, number: string][]): Promise<void> {
    await this.db
      .insert(folderEntries)
      .values(entries.map(([scoreId, number]) => ({ folderId, scoreId, number, numberSortKey: naturalSortKey(number) })));
  }

  async event(ensembleId: string, name: string, date: string, showInMyArea = true): Promise<string> {
    const id = uuidv7();
    await this.db.insert(events).values({ id, ensembleId, name, date, showInMyArea });
    return id;
  }

  async setlist(eventId: string, scoreIds: string[]): Promise<void> {
    await this.db.insert(setlistEntries).values(scoreIds.map((scoreId, i) => ({ eventId, scoreId, position: i + 1 })));
  }

  async lineup(ensembleId: string, voiceIds: string[]): Promise<void> {
    await this.db.insert(ensembleLineupVoices).values(voiceIds.map((voiceId, position) => ({ ensembleId, voiceId, position })));
  }

  /** The single `club_settings` row with the given default ensemble. */
  async settings(defaultEnsembleId: string | null): Promise<void> {
    await this.db.insert(clubSettings).values({ id: 1, clubName: 'Testverein', defaultEnsembleId });
  }

  async clubTag(name: string, scoreIds: string[] = []): Promise<string> {
    const id = uuidv7();
    await this.db.insert(clubTags).values({ id, name });
    if (scoreIds.length) await this.db.insert(scoreClubTags).values(scoreIds.map((scoreId) => ({ scoreId, tagId: id })));
    return id;
  }
}

/** `YYYY-MM-DD` shifted by whole days. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
