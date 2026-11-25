import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import {
  API_ROUTES,
  createdResponseSchema,
  createFolderBodySchema,
  ensembleOptionsResponseSchema,
  folderDetailsResponseSchema,
  folderEntriesQuerySchema,
  folderEntriesResponseSchema,
  folderListQuerySchema,
  folderListResponseSchema,
  folderParamsSchema,
  folderRemoveScoreBodySchema,
  folderScoreCandidatesQuerySchema,
  folderScoreCandidatesResponseSchema,
  folderScoreNumberBodySchema,
  renameBodySchema,
  setVisibilityBodySchema,
  type CreateFolderBody,
  type FolderEntriesQuery,
  type FolderListQuery,
  type FolderRemoveScoreBody,
  type FolderScoreNumberBody,
  type RenameBody,
  type SetVisibilityBody,
} from '@vm-web/shared';
import type { AccessContext } from '../access/access-context';
import { CurrentAccess, RequirePermission, type EnsembleSource } from '../access/decorators';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe as Zod } from '../common/validation/zod-validation.pipe';
import { FoldersService } from './folders.service';

const R = API_ROUTES.folders;
/** Ensemble of the folder in the path. */
const OF_FOLDER: EnsembleSource = { resolver: 'folder', from: 'param:folderId' };
type FolderParams = { folderId: string };

/** Folders belong to an ensemble → `folder.*` in that ensemble or a parent (R-4, F-3). */
@Controller(R.base)
export class FoldersController {
  constructor(@Inject(FoldersService) private readonly folders: FoldersService) {}

  /** Requires `folder.create` in at least one ensemble (checked in the service). */
  @Get(R.ensembleOptions.path)
  @ResponseSchema(ensembleOptionsResponseSchema)
  ensembleOptions(@CurrentAccess() access: AccessContext) {
    return this.folders.ensembleOptions(access);
  }

  /** Filtered to ensembles with `folder.view`. */
  @Get(R.folderList.path)
  @ResponseSchema(folderListResponseSchema)
  list(@CurrentAccess() access: AccessContext, @Query(new Zod(folderListQuerySchema)) q: FolderListQuery) {
    return this.folders.list(access, q);
  }

  @RequirePermission('folder.view', { ensembleFrom: OF_FOLDER })
  @Get(R.folderDetails.path)
  @ResponseSchema(folderDetailsResponseSchema)
  details(@Param(new Zod(folderParamsSchema)) p: FolderParams) {
    return this.folders.details(p.folderId);
  }

  @RequirePermission('folder.view', { ensembleFrom: OF_FOLDER })
  @Get(R.folderEntries.path)
  @ResponseSchema(folderEntriesResponseSchema)
  entries(@Param(new Zod(folderParamsSchema)) p: FolderParams, @Query(new Zod(folderEntriesQuerySchema)) q: FolderEntriesQuery) {
    return this.folders.entries(p.folderId, q);
  }

  @RequirePermission('folder.edit', { ensembleFrom: OF_FOLDER })
  @Get(R.scoreCandidates.path)
  @ResponseSchema(folderScoreCandidatesResponseSchema)
  candidates(@Param(new Zod(folderParamsSchema)) p: FolderParams, @Query(new Zod(folderScoreCandidatesQuerySchema)) q: { q: string; cursor?: string; limit: number }) {
    return this.folders.candidates(p.folderId, q);
  }

  @RequirePermission('folder.create', { ensembleFrom: 'body:ensembleId' })
  @Post(R.createFolder.path)
  @ResponseSchema(createdResponseSchema)
  create(@Body(new Zod(createFolderBodySchema)) body: CreateFolderBody) {
    return this.folders.create(body);
  }

  @RequirePermission('folder.edit', { ensembleFrom: OF_FOLDER })
  @Post(R.renameFolder.path)
  @HttpCode(204)
  async rename(@Param(new Zod(folderParamsSchema)) p: FolderParams, @Body(new Zod(renameBodySchema)) body: RenameBody) {
    await this.folders.rename(p.folderId, body.name);
  }

  @RequirePermission('folder.edit', { ensembleFrom: OF_FOLDER })
  @Post(R.setVisibility.path)
  @HttpCode(204)
  async setVisibility(@Param(new Zod(folderParamsSchema)) p: FolderParams, @Body(new Zod(setVisibilityBodySchema)) body: SetVisibilityBody) {
    await this.folders.setVisibility(p.folderId, body.showInMyArea);
  }

  @RequirePermission('folder.edit', { ensembleFrom: OF_FOLDER })
  @Post(R.addScore.path)
  @HttpCode(204)
  async addScore(@Param(new Zod(folderParamsSchema)) p: FolderParams, @Body(new Zod(folderScoreNumberBodySchema)) body: FolderScoreNumberBody) {
    await this.folders.addScore(p.folderId, body.scoreId, body.number, body.numberSuffix);
  }

  @RequirePermission('folder.edit', { ensembleFrom: OF_FOLDER })
  @Post(R.setScoreNumber.path)
  @HttpCode(204)
  async setScoreNumber(@Param(new Zod(folderParamsSchema)) p: FolderParams, @Body(new Zod(folderScoreNumberBodySchema)) body: FolderScoreNumberBody) {
    await this.folders.setScoreNumber(p.folderId, body.scoreId, body.number, body.numberSuffix);
  }

  @RequirePermission('folder.edit', { ensembleFrom: OF_FOLDER })
  @Post(R.removeScore.path)
  @HttpCode(204)
  async removeScore(@Param(new Zod(folderParamsSchema)) p: FolderParams, @Body(new Zod(folderRemoveScoreBodySchema)) body: FolderRemoveScoreBody) {
    await this.folders.removeScore(p.folderId, body.scoreId);
  }

  @RequirePermission('folder.delete', { ensembleFrom: OF_FOLDER })
  @Post(R.deleteFolder.path)
  @HttpCode(204)
  async delete(@Param(new Zod(folderParamsSchema)) p: FolderParams) {
    await this.folders.delete(p.folderId);
  }
}
