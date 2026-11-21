import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, StreamableFile } from '@nestjs/common';
import {
  API_ROUTES,
  createdResponseSchema,
  createFieldBodySchema,
  createScoreBodySchema,
  fieldDefinitionsResponseSchema,
  fieldParamsSchema,
  librarySheetPdfQuerySchema,
  reorderFieldsBodySchema,
  scoreCompletenessQuerySchema,
  scoreCompletenessResponseSchema,
  scoreDetailsResponseSchema,
  scoreEnsembleOptionsResponseSchema,
  scoreFoldersResponseSchema,
  scoreParamsSchema,
  scoreSheetsResponseSchema,
  scoreTableExportQuerySchema,
  scoreTableQuerySchema,
  scoreTableResponseSchema,
  scoreTagOptionsResponseSchema,
  scoreImportBodySchema,
  scoreImportResponseSchema,
  sheetParamsSchema,
  updateFieldBodySchema,
  updateScoreDetailsBodySchema,
  type CreateFieldBody,
  type CreateScoreBody,
  type ReorderFieldsBody,
  type ScoreCompletenessQuery,
  type ScoreImportBody,
  type ScoreTableExportQuery,
  type ScoreTableQuery,
  type UpdateFieldBody,
  type UpdateScoreDetailsBody,
} from '@vm-web/shared';
import type { AccessContext } from '../access/access-context';
import { CurrentAccess, RequirePermission } from '../access/decorators';
import { contentDisposition } from '../common/files/download-names';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe as Zod } from '../common/validation/zod-validation.pipe';
import { todayIn } from '../common/time/today';
import { FieldsService } from './fields.service';
import { ScoreImportService } from './score-import.service';
import { ScoresService } from './scores.service';

const R = API_ROUTES.scores;

/** Library: scores and custom fields. Scores have no ensemble → `score.*` in at least one ensemble (R-4). */
@Controller(R.base)
export class ScoresController {
  constructor(
    @Inject(ScoresService) private readonly scores: ScoresService,
    @Inject(FieldsService) private readonly fields: FieldsService,
    @Inject(ScoreImportService) private readonly importer: ScoreImportService,
  ) {}

  @RequirePermission('score.view')
  @Get(R.scoreTable.path)
  @ResponseSchema(scoreTableResponseSchema)
  scoreTable(@Query(new Zod(scoreTableQuerySchema)) q: ScoreTableQuery) {
    return this.scores.table(q);
  }

  @RequirePermission('score.view')
  @Get(R.scoreTableExport.path)
  async export(@Query(new Zod(scoreTableExportQuerySchema)) q: ScoreTableExportQuery): Promise<StreamableFile> {
    const csv = await this.scores.export(q);
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: contentDisposition('attachment', `stuecke-${todayIn('UTC')}.csv`),
    });
  }

  @RequirePermission(['score.view', 'config.view'])
  @Get(R.fieldDefinitions.path)
  @ResponseSchema(fieldDefinitionsResponseSchema)
  fieldDefinitions() {
    return this.fields.list();
  }

  @RequirePermission('score.view')
  @Get(R.ensembleOptions.path)
  @ResponseSchema(scoreEnsembleOptionsResponseSchema)
  ensembleOptions() {
    return this.scores.ensembleOptions();
  }

  @RequirePermission('score.view')
  @Get(R.tagOptions.path)
  @ResponseSchema(scoreTagOptionsResponseSchema)
  tagOptions() {
    return this.scores.tagOptions();
  }

  @RequirePermission('score.view')
  @Get(R.scoreDetails.path)
  @ResponseSchema(scoreDetailsResponseSchema)
  details(@Param(new Zod(scoreParamsSchema)) p: { scoreId: string }) {
    return this.scores.details(p.scoreId);
  }

  @RequirePermission('score.view')
  @Get(R.scoreCompleteness.path)
  @ResponseSchema(scoreCompletenessResponseSchema)
  completeness(@Param(new Zod(scoreParamsSchema)) p: { scoreId: string }, @Query(new Zod(scoreCompletenessQuerySchema)) q: ScoreCompletenessQuery) {
    return this.scores.completeness(p.scoreId, q.ensembleId);
  }

  @RequirePermission('score.view')
  @Get(R.scoreSheets.path)
  @ResponseSchema(scoreSheetsResponseSchema)
  sheets(@Param(new Zod(scoreParamsSchema)) p: { scoreId: string }) {
    return this.scores.sheets(p.scoreId);
  }

  @RequirePermission('score.view')
  @Get(R.scoreFolders.path)
  @ResponseSchema(scoreFoldersResponseSchema)
  folders(@Param(new Zod(scoreParamsSchema)) p: { scoreId: string }, @CurrentAccess() access: AccessContext) {
    return this.scores.folders(p.scoreId, access);
  }

  @RequirePermission('score.view')
  @Get(R.sheetPdf.path)
  async sheetPdf(
    @Param(new Zod(sheetParamsSchema)) p: { sheetId: string },
    @Query(new Zod(librarySheetPdfQuerySchema)) q: { disposition: 'inline' | 'attachment' },
  ): Promise<StreamableFile> {
    const { stream, fileName } = await this.scores.sheetFile(p.sheetId);
    return new StreamableFile(stream, { type: 'application/pdf', disposition: contentDisposition(q.disposition, fileName) });
  }

  @RequirePermission('score.create')
  @Post(R.createScore.path)
  @ResponseSchema(createdResponseSchema)
  create(@Body(new Zod(createScoreBodySchema)) body: CreateScoreBody) {
    return this.scores.create(body);
  }

  /** CSV import (N-19); the service additionally checks `score.edit` and the folder permissions. */
  @RequirePermission('score.create')
  @Post(R.importScores.path)
  @HttpCode(200)
  @ResponseSchema(scoreImportResponseSchema)
  importScores(@Body(new Zod(scoreImportBodySchema)) body: ScoreImportBody, @CurrentAccess() access: AccessContext) {
    return this.importer.run(body, access);
  }

  @RequirePermission('score.edit')
  @Post(R.updateScoreDetails.path)
  @HttpCode(204)
  async update(@Param(new Zod(scoreParamsSchema)) p: { scoreId: string }, @Body(new Zod(updateScoreDetailsBodySchema)) body: UpdateScoreDetailsBody) {
    await this.scores.update(p.scoreId, body);
  }

  @RequirePermission('score.delete')
  @Post(R.deleteScore.path)
  @HttpCode(204)
  async delete(@Param(new Zod(scoreParamsSchema)) p: { scoreId: string }) {
    await this.scores.delete(p.scoreId);
  }

  @RequirePermission('score.edit')
  @Post(R.deleteSheet.path)
  @HttpCode(204)
  async deleteSheet(@Param(new Zod(sheetParamsSchema)) p: { sheetId: string }) {
    await this.scores.deleteSheet(p.sheetId);
  }

  // --- custom fields (N-2, F-13) ------------------------------------------------------------------------------

  @RequirePermission(['score.edit', 'config.edit'])
  @Post(R.createField.path)
  @ResponseSchema(createdResponseSchema)
  createField(@Body(new Zod(createFieldBodySchema)) body: CreateFieldBody) {
    return this.fields.create(body);
  }

  @RequirePermission(['score.edit', 'config.edit'])
  @Post(R.updateField.path)
  @HttpCode(204)
  async updateField(@Param(new Zod(fieldParamsSchema)) p: { fieldId: string }, @Body(new Zod(updateFieldBodySchema)) body: UpdateFieldBody) {
    await this.fields.update(p.fieldId, body);
  }

  @RequirePermission(['score.delete', 'config.edit'])
  @Post(R.deleteField.path)
  @HttpCode(204)
  async deleteField(@Param(new Zod(fieldParamsSchema)) p: { fieldId: string }) {
    await this.fields.delete(p.fieldId);
  }

  @RequirePermission(['score.edit', 'config.edit'])
  @Post(R.reorderFields.path)
  @HttpCode(204)
  async reorderFields(@Body(new Zod(reorderFieldsBodySchema)) body: ReorderFieldsBody) {
    await this.fields.reorder(body.fieldIds);
  }
}
