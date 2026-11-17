import { Body, Controller, Get, Inject, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  API_ROUTES,
  scoreSearchQuerySchema,
  scoreSearchResponseSchema,
  UPLOAD_FILE_FIELD,
  UPLOAD_MAX_FILES,
  UPLOAD_META_FIELD,
  uploadSheetsResponseSchema,
  voiceSuggestionsQuerySchema,
  voiceSuggestionsResponseSchema,
  type ScoreSearchQuery,
  type VoiceSuggestionsQuery,
} from '@vm-web/shared';
import type { AccessContext } from '../access/access-context';
import { CurrentAccess, RequirePermission } from '../access/decorators';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe as Zod } from '../common/validation/zod-validation.pipe';
import { UploadsService, type UploadedFileInfo } from './uploads.service';

const R = API_ROUTES.uploads;

/** Upload dialog (N-11). Uploading needs `sheet.upload` (F-2), held in at least one ensemble. */
@Controller(R.base)
export class UploadsController {
  constructor(@Inject(UploadsService) private readonly uploads: UploadsService) {}

  @RequirePermission('sheet.upload')
  @Get(R.voiceSuggestions.path)
  @ResponseSchema(voiceSuggestionsResponseSchema)
  voiceSuggestions(@Query(new Zod(voiceSuggestionsQuerySchema)) q: VoiceSuggestionsQuery) {
    return this.uploads.voiceSuggestions(q.fileName);
  }

  @RequirePermission(['sheet.upload', 'sheet.approve'])
  @Get(R.scoreSearch.path)
  @ResponseSchema(scoreSearchResponseSchema)
  scoreSearch(@CurrentAccess() access: AccessContext, @Query(new Zod(scoreSearchQuerySchema)) q: ScoreSearchQuery) {
    return this.uploads.scoreSearch(access, q);
  }

  /** `multipart/form-data`: `files` (1..50 PDFs) and `meta` (JSON). Guards run before the files are read. */
  @RequirePermission('sheet.upload')
  @Post(R.uploadSheets.path)
  @UseInterceptors(FilesInterceptor(UPLOAD_FILE_FIELD, UPLOAD_MAX_FILES))
  @ResponseSchema(uploadSheetsResponseSchema)
  upload(
    @CurrentAccess() access: AccessContext,
    @UploadedFiles() files: UploadedFileInfo[] | undefined,
    @Body() body: Record<string, unknown> | undefined,
  ) {
    return this.uploads.upload(access, files ?? [], body?.[UPLOAD_META_FIELD]);
  }
}
