import { Inject, Injectable } from '@nestjs/common';
import type {
  MemberScoreRow,
  MyEventItem,
  MyEventOverviewResponse,
  MyEventSetlistItem,
  MyFolderItem,
  MyFolderOverviewResponse,
  MyScoreOverviewResponse,
  MyTagsResponse,
  MyUploadItem,
  MyUploadsQuery,
  Page,
  UploadSummaryResponse,
  ProfileResponse,
  VoiceContextResponse,
  VoiceOptionsResponse,
  VoiceRef,
} from '@vm-web/shared';
import type { AccessContext } from '../access/access-context';
import type { AccessUser } from '../access/access.repository';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { todayIn } from '../common/time/today';
import { httpUrlOrNull } from '../common/url';
import { AppConfig } from '../config/app-config.service';
import { MeRepository, type EventRow, type ScoreFilter, type ScoreListRow } from './me.repository';
import { defaultPageCount, relevantVoiceIds, resolveSheets, type VoiceSelection } from './sheet-resolution';
import { assertKnownIds } from '../common/validation/id-list';

export interface ActiveVoices extends VoiceSelection {
  profile: VoiceRef[];
  isOverride: boolean;
}

/** Mein Bereich (M-1..M-5, M-8, R-2): read models filtered to the caller's ensembles and voices. */
@Injectable()
export class MeService {
  constructor(
    @Inject(MeRepository) private readonly repo: MeRepository,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  /**
   * Active voices: the profile voices, or the voices of a temporary switch (M-2) without touching
   * the profile; plus the ordered substitutes of every active voice (M-3, N-9).
   */
  async activeVoices(userId: string, overrideIds: readonly string[]): Promise<ActiveVoices> {
    const profile = await this.repo.profileVoices(userId);
    let active = profile;
    const isOverride = overrideIds.length > 0;
    if (isOverride) {
      const unique = [...new Set(overrideIds)];
      const found = new Map((await this.repo.voicesByIds(unique)).map((v) => [v.id, v]));
      assertKnownIds(unique, found, '/query/voiceId', 'unknown_voice');
      active = unique.map((id) => found.get(id) as VoiceRef);
    }
    const substitutesOf = await this.repo.substitutesOf(active.map((v) => v.id));
    return { profile, active, isOverride, substitutesOf };
  }

  async voiceContext(userId: string, overrideIds: readonly string[]): Promise<VoiceContextResponse> {
    const v = await this.activeVoices(userId, overrideIds);
    const substitutes = new Map<string, VoiceRef>();
    const activeIds = new Set(v.active.map((a) => a.id));
    for (const voice of v.active) {
      for (const sub of v.substitutesOf.get(voice.id) ?? []) if (!activeIds.has(sub.id)) substitutes.set(sub.id, sub);
    }
    return {
      profileVoices: v.profile,
      activeVoices: [...v.active],
      isOverride: v.isOverride,
      substituteVoices: [...substitutes.values()],
      needsVoiceSelection: v.profile.length === 0,
    };
  }

  async voiceOptions(): Promise<VoiceOptionsResponse> {
    return { groups: await this.repo.voiceGroups() };
  }

  async setProfileVoices(voiceIds: readonly string[], userId: string): Promise<void> {
    const unique = [...new Set(voiceIds)];
    const found = new Set((await this.repo.voicesByIds(unique)).map((v) => v.id));
    assertKnownIds(voiceIds, found, '/body/voiceIds', 'unknown_voice');
    await this.repo.replaceProfileVoices(userId, unique);
  }

  // --- events -----------------------------------------------------------------------------------------------

  async events(
    access: AccessContext,
    period: 'upcoming' | 'archived',
    query: { cursor?: string; limit: number },
  ): Promise<Page<MyEventItem>> {
    const rows = await this.repo.events(
      access.memberEnsembleIds(),
      period,
      this.today(),
      decodeCursor(query.cursor, 2),
      query.limit,
    );
    return toPage(rows, query.limit, (r) => [r.date, r.id], toEventItem);
  }

  async eventOverview(access: AccessContext, eventId: string, overrideIds: readonly string[]): Promise<MyEventOverviewResponse> {
    const event = await this.repo.event(access.memberEnsembleIds(), eventId);
    if (!event) throw ProblemException.notFound();
    const counts = await this.counts(access.userId, overrideIds, await this.repo.eventScoreIds(eventId));
    return { ...toEventItem(event), isPast: event.date < this.today(), ...counts };
  }

  async setlist(
    access: AccessContext,
    eventId: string,
    query: { cursor?: string; limit: number; voiceId: string[] },
  ): Promise<Page<MyEventSetlistItem>> {
    if (!(await this.repo.event(access.memberEnsembleIds(), eventId))) throw ProblemException.notFound();
    const rows = await this.repo.setlist(eventId, decodeCursor(query.cursor, 1), query.limit);
    const page = rows.slice(0, query.limit);
    const memberRows = await this.memberRows(access.userId, query.voiceId, page);
    return toPage(rows, query.limit, (r) => [r.position], (r) => ({
      ...(memberRows.get(r.scoreId) as MemberScoreRow),
      position: r.position,
    }));
  }

  // --- folders ----------------------------------------------------------------------------------------------

  async folders(access: AccessContext, query: { cursor?: string; limit: number }): Promise<Page<MyFolderItem>> {
    const rows = await this.repo.folders(access.memberEnsembleIds(), decodeCursor(query.cursor, 3), query.limit);
    return toPage(rows, query.limit, (r) => [r.sortEnsemble, r.sortName, r.id], (r) => ({
      id: r.id,
      name: r.name,
      ensemble: { id: r.ensembleId, name: r.ensembleName },
      scoreCount: r.scoreCount,
    }));
  }

  async folderOverview(access: AccessContext, folderId: string, overrideIds: readonly string[]): Promise<MyFolderOverviewResponse> {
    const folder = await this.repo.folder(access.memberEnsembleIds(), folderId);
    if (!folder) throw ProblemException.notFound();
    const counts = await this.counts(access.userId, overrideIds, await this.repo.folderScoreIds(folderId));
    return { id: folder.id, name: folder.name, ensemble: { id: folder.ensembleId, name: folder.ensembleName }, ...counts };
  }

  async folderScores(
    access: AccessContext,
    folderId: string,
    query: { cursor?: string; limit: number; voiceId: string[]; q?: string; clubTagId?: string; personalTagId?: string },
  ): Promise<Page<MemberScoreRow>> {
    if (!(await this.repo.folder(access.memberEnsembleIds(), folderId))) throw ProblemException.notFound();
    const filter: ScoreFilter = {
      q: query.q || undefined,
      clubTagId: query.clubTagId,
      personalTag: query.personalTagId ? { userId: access.userId, tagId: query.personalTagId } : undefined,
    };
    const rows = await this.repo.folderScores(folderId, filter, decodeCursor(query.cursor, 2), query.limit);
    return this.scorePage(access.userId, query, rows);
  }

  // --- tags -------------------------------------------------------------------------------------------------

  async tags(access: AccessContext): Promise<MyTagsResponse> {
    const { club, personal } = await this.repo.tagsWithCounts(access.userId, access.memberEnsembleIds());
    return { clubTags: club, personalTags: personal };
  }

  async tagScores(
    access: AccessContext,
    kind: 'club' | 'personal',
    tagId: string,
    query: { cursor?: string; limit: number; voiceId: string[]; q?: string },
  ): Promise<Page<MemberScoreRow>> {
    const exists =
      kind === 'club' ? await this.repo.clubTagExists(tagId) : !!(await this.repo.personalTagOf(access.userId, tagId));
    if (!exists) throw ProblemException.notFound();
    const filter: ScoreFilter = {
      q: query.q || undefined,
      ...(kind === 'club' ? { clubTagId: tagId } : { personalTag: { userId: access.userId, tagId } }),
    };
    const rows = await this.repo.taggedScores(access.memberEnsembleIds(), filter, decodeCursor(query.cursor, 2), query.limit);
    return this.scorePage(access.userId, query, rows);
  }

  // --- score ------------------------------------------------------------------------------------------------

  async scoreOverview(access: AccessContext, scoreId: string, overrideIds: readonly string[]): Promise<MyScoreOverviewResponse> {
    const score = await this.repo.visibleScore(access.memberEnsembleIds(), scoreId);
    if (!score) throw ProblemException.notFound();
    const voicesSel = await this.activeVoices(access.userId, overrideIds);
    const [sheets, tags] = await Promise.all([
      this.repo.sheetsFor([scoreId], relevantVoiceIds(voicesSel)),
      this.repo.scoreTags(access.userId, scoreId),
    ]);
    const resolved = resolveSheets(voicesSel, sheets.get(scoreId) ?? []);
    return {
      ...score,
      availability: resolved.availability,
      sheets: resolved.sheets,
      missingVoices: resolved.missingVoices.map((v) => ({ id: v.id, name: v.name })),
      clubTags: tags.club,
      personalTags: tags.personal,
    };
  }

  // --- own uploads (N-14) -----------------------------------------------------------------------------------

  /** Pending uploads and decisions of the last 30 days. */
  async uploadSummary(userId: string): Promise<UploadSummaryResponse> {
    return this.repo.uploadSummary(userId, new Date(Date.now() - 30 * 86_400_000));
  }

  async myUploads(userId: string, query: MyUploadsQuery): Promise<Page<MyUploadItem>> {
    const rows = await this.repo.myUploads(userId, query.status, decodeCursor(query.cursor, 2), query.limit);
    return toPage(rows, query.limit, (r) => [r.uploadedAt.toISOString(), r.id], (r) => ({
      ...r,
      uploadedAt: r.uploadedAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
    }));
  }

  // --- profile ----------------------------------------------------------------------------------------------

  async profile(user: AccessUser, access: AccessContext): Promise<ProfileResponse> {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      pictureUrl: httpUrlOrNull(user.pictureUrl),
      voices: await this.repo.profileVoices(user.id),
      memberships: access.memberships.map((m) => ({
        ensemble: { id: m.ensembleId, name: m.ensembleName },
        role: { id: m.roleId, name: m.roleName },
      })),
      isAdmin: user.isAdmin,
    };
  }

  // --- helpers ----------------------------------------------------------------------------------------------

  private today(): string {
    return todayIn(this.config.get('APP_TIMEZONE'));
  }

  /** `missingCount` and `totalPages` over all scores of a folder or event (M-3, D-2). */
  private async counts(userId: string, overrideIds: readonly string[], scoreIds: string[]) {
    const voicesSel = await this.activeVoices(userId, overrideIds);
    const sheets = await this.repo.sheetsFor(scoreIds, relevantVoiceIds(voicesSel));
    let missingCount = 0;
    let totalPages = 0;
    for (const id of scoreIds) {
      const resolved = resolveSheets(voicesSel, sheets.get(id) ?? []);
      if (resolved.availability === 'missing') missingCount++;
      totalPages += defaultPageCount(resolved);
    }
    return { scoreCount: scoreIds.length, missingCount, totalPages };
  }

  /** Member rows (sheets per active voice) for one page of scores. */
  private async memberRows(userId: string, overrideIds: readonly string[], rows: readonly ScoreListRow[]) {
    const voicesSel = await this.activeVoices(userId, overrideIds);
    const sheets = await this.repo.sheetsFor(
      rows.map((r) => r.scoreId),
      relevantVoiceIds(voicesSel),
    );
    const result = new Map<string, MemberScoreRow>();
    for (const r of rows) {
      const resolved = resolveSheets(voicesSel, sheets.get(r.scoreId) ?? []);
      result.set(r.scoreId, {
        scoreId: r.scoreId,
        number: r.number,
        title: r.title,
        composer: r.composer,
        availability: resolved.availability,
        sheets: resolved.sheets,
      });
    }
    return result;
  }

  private async scorePage(
    userId: string,
    query: { limit: number; voiceId: string[] },
    rows: ScoreListRow[],
  ): Promise<Page<MemberScoreRow>> {
    const memberRows = await this.memberRows(userId, query.voiceId, rows.slice(0, query.limit));
    return toPage(rows, query.limit, (r) => [r.sortKey, r.scoreId], (r) => memberRows.get(r.scoreId) as MemberScoreRow);
  }
}

function toEventItem(r: EventRow): MyEventItem {
  return {
    id: r.id,
    name: r.name,
    date: r.date,
    ensemble: { id: r.ensembleId, name: r.ensembleName },
    scoreCount: r.scoreCount,
  };
}
