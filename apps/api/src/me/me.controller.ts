import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import {
  API_ROUTES,
  archivedEventsQuerySchema,
  createdResponseSchema,
  createPersonalTagBodySchema,
  eventParamsSchema,
  folderParamsSchema,
  myEventOverviewResponseSchema,
  myEventSetlistQuerySchema,
  myEventSetlistResponseSchema,
  myFolderOverviewResponseSchema,
  myFolderScoresQuerySchema,
  myFolderScoresResponseSchema,
  myFoldersQuerySchema,
  myFoldersResponseSchema,
  myScoreOverviewResponseSchema,
  myTagScoresQuerySchema,
  myTagScoresResponseSchema,
  myTagsResponseSchema,
  personalTagAssignmentBodySchema,
  profileResponseSchema,
  renamePersonalTagBodySchema,
  scoreParamsSchema,
  setMyVoicesBodySchema,
  tagParamsSchema,
  upcomingEventsQuerySchema,
  upcomingEventsResponseSchema,
  voiceContextQuerySchema,
  voiceContextResponseSchema,
  voiceOptionsResponseSchema,
  archivedEventsResponseSchema,
  myUploadsQuerySchema,
  myUploadsResponseSchema,
  uploadSummaryResponseSchema,
  type MyUploadsQuery,
  type CreatePersonalTagBody,
  type CursorQuery,
  type MyEventSetlistQuery,
  type MyFolderScoresQuery,
  type MyTagScoresQuery,
  type PersonalTagAssignmentBody,
  type RenamePersonalTagBody,
  type SetMyVoicesBody,
  type VoiceContextQuery,
} from '@vm-web/shared';
import type { AccessContext } from '../access/access-context';
import type { AccessUser } from '../access/access.repository';
import { CurrentAccess, CurrentUser } from '../access/decorators';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe as Zod } from '../common/validation/zod-validation.pipe';
import { MeService } from './me.service';
import { PersonalTagsService } from './personal-tags.service';

const R = API_ROUTES.me;

/**
 * Mein Bereich. No permission needed: a session is enough, content comes only from the
 * caller's ensembles (incl. sub-ensembles) and released folders/events (R-2, H-1, F-6).
 */
@Controller(R.base)
export class MeController {
  constructor(
    @Inject(MeService) private readonly me: MeService,
    @Inject(PersonalTagsService) private readonly personalTags: PersonalTagsService,
  ) {}

  @Get(R.voiceContext.path)
  @ResponseSchema(voiceContextResponseSchema)
  voiceContext(@CurrentAccess() access: AccessContext, @Query(new Zod(voiceContextQuerySchema)) q: VoiceContextQuery) {
    return this.me.voiceContext(access.userId, q.voiceId);
  }

  @Get(R.voiceOptions.path)
  @ResponseSchema(voiceOptionsResponseSchema)
  voiceOptions() {
    return this.me.voiceOptions();
  }

  @Get(R.upcomingEvents.path)
  @ResponseSchema(upcomingEventsResponseSchema)
  upcomingEvents(@CurrentAccess() access: AccessContext, @Query(new Zod(upcomingEventsQuerySchema)) q: CursorQuery) {
    return this.me.events(access, 'upcoming', q);
  }

  @Get(R.archivedEvents.path)
  @ResponseSchema(archivedEventsResponseSchema)
  archivedEvents(@CurrentAccess() access: AccessContext, @Query(new Zod(archivedEventsQuerySchema)) q: CursorQuery) {
    return this.me.events(access, 'archived', q);
  }

  @Get(R.folders.path)
  @ResponseSchema(myFoldersResponseSchema)
  folders(@CurrentAccess() access: AccessContext, @Query(new Zod(myFoldersQuerySchema)) q: CursorQuery) {
    return this.me.folders(access, q);
  }

  @Get(R.uploadSummary.path)
  @ResponseSchema(uploadSummaryResponseSchema)
  uploadSummary(@CurrentAccess() access: AccessContext) {
    return this.me.uploadSummary(access.userId);
  }

  @Get(R.myUploads.path)
  @ResponseSchema(myUploadsResponseSchema)
  myUploads(@CurrentAccess() access: AccessContext, @Query(new Zod(myUploadsQuerySchema)) q: MyUploadsQuery) {
    return this.me.myUploads(access.userId, q);
  }

  @Get(R.folderOverview.path)
  @ResponseSchema(myFolderOverviewResponseSchema)
  folderOverview(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(folderParamsSchema)) p: { folderId: string },
    @Query(new Zod(voiceContextQuerySchema)) q: VoiceContextQuery,
  ) {
    return this.me.folderOverview(access, p.folderId, q.voiceId);
  }

  @Get(R.folderScores.path)
  @ResponseSchema(myFolderScoresResponseSchema)
  folderScores(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(folderParamsSchema)) p: { folderId: string },
    @Query(new Zod(myFolderScoresQuerySchema)) q: MyFolderScoresQuery,
  ) {
    return this.me.folderScores(access, p.folderId, q);
  }

  @Get(R.eventOverview.path)
  @ResponseSchema(myEventOverviewResponseSchema)
  eventOverview(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(eventParamsSchema)) p: { eventId: string },
    @Query(new Zod(voiceContextQuerySchema)) q: VoiceContextQuery,
  ) {
    return this.me.eventOverview(access, p.eventId, q.voiceId);
  }

  @Get(R.eventSetlist.path)
  @ResponseSchema(myEventSetlistResponseSchema)
  eventSetlist(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(eventParamsSchema)) p: { eventId: string },
    @Query(new Zod(myEventSetlistQuerySchema)) q: MyEventSetlistQuery,
  ) {
    return this.me.setlist(access, p.eventId, q);
  }

  @Get(R.tags.path)
  @ResponseSchema(myTagsResponseSchema)
  tags(@CurrentAccess() access: AccessContext) {
    return this.me.tags(access);
  }

  @Get(R.clubTagScores.path)
  @ResponseSchema(myTagScoresResponseSchema)
  clubTagScores(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(tagParamsSchema)) p: { tagId: string },
    @Query(new Zod(myTagScoresQuerySchema)) q: MyTagScoresQuery,
  ) {
    return this.me.tagScores(access, 'club', p.tagId, q);
  }

  @Get(R.personalTagScores.path)
  @ResponseSchema(myTagScoresResponseSchema)
  personalTagScores(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(tagParamsSchema)) p: { tagId: string },
    @Query(new Zod(myTagScoresQuerySchema)) q: MyTagScoresQuery,
  ) {
    return this.me.tagScores(access, 'personal', p.tagId, q);
  }

  @Get(R.scoreOverview.path)
  @ResponseSchema(myScoreOverviewResponseSchema)
  scoreOverview(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(scoreParamsSchema)) p: { scoreId: string },
    @Query(new Zod(voiceContextQuerySchema)) q: VoiceContextQuery,
  ) {
    return this.me.scoreOverview(access, p.scoreId, q.voiceId);
  }

  @Get(R.profile.path)
  @ResponseSchema(profileResponseSchema)
  profile(@CurrentUser() user: AccessUser, @CurrentAccess() access: AccessContext) {
    return this.me.profile(user, access);
  }

  @Post(R.setVoices.path)
  @HttpCode(204)
  async setVoices(@CurrentAccess() access: AccessContext, @Body(new Zod(setMyVoicesBodySchema)) body: SetMyVoicesBody) {
    await this.me.setProfileVoices(body.voiceIds, access.userId);
  }

  @Post(R.createPersonalTag.path)
  @ResponseSchema(createdResponseSchema)
  createPersonalTag(@CurrentAccess() access: AccessContext, @Body(new Zod(createPersonalTagBodySchema)) body: CreatePersonalTagBody) {
    return this.personalTags.create(access.userId, body.name);
  }

  @Post(R.renamePersonalTag.path)
  @HttpCode(204)
  async renamePersonalTag(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(tagParamsSchema)) p: { tagId: string },
    @Body(new Zod(renamePersonalTagBodySchema)) body: RenamePersonalTagBody,
  ) {
    await this.personalTags.rename(access.userId, p.tagId, body.name);
  }

  @Post(R.deletePersonalTag.path)
  @HttpCode(204)
  async deletePersonalTag(@CurrentAccess() access: AccessContext, @Param(new Zod(tagParamsSchema)) p: { tagId: string }) {
    await this.personalTags.delete(access.userId, p.tagId);
  }

  @Post(R.addPersonalTag.path)
  @HttpCode(204)
  async addPersonalTag(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(scoreParamsSchema)) p: { scoreId: string },
    @Body(new Zod(personalTagAssignmentBodySchema)) body: PersonalTagAssignmentBody,
  ) {
    await this.personalTags.add(access, p.scoreId, body.tagId);
  }

  @Post(R.removePersonalTag.path)
  @HttpCode(204)
  async removePersonalTag(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(scoreParamsSchema)) p: { scoreId: string },
    @Body(new Zod(personalTagAssignmentBodySchema)) body: PersonalTagAssignmentBody,
  ) {
    await this.personalTags.remove(access, p.scoreId, body.tagId);
  }
}
