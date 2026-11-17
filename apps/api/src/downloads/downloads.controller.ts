import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, StreamableFile } from '@nestjs/common';
import {
  API_ROUTES,
  eventParamsSchema,
  folderParamsSchema,
  printDocumentQuerySchema,
  printPlanResponseSchema,
  printQuerySchema,
  selectionZipBodySchema,
  sheetParamsSchema,
  sheetPdfQuerySchema,
  zipQuerySchema,
  type PrintQuery,
  type SelectionZipBody,
  type SheetPdfQuery,
  type ZipQuery,
} from '@vm-web/shared';
import type { Readable } from 'node:stream';
import type { AccessContext } from '../access/access-context';
import { CurrentAccess } from '../access/decorators';
import { contentDisposition } from '../common/files/download-names';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe as Zod } from '../common/validation/zod-validation.pipe';
import { DownloadsService } from './downloads.service';

const ME = API_ROUTES.me;
const PRINT = API_ROUTES.print;
const zipFile = (body: Readable, fileName: string) =>
  new StreamableFile(body, { type: 'application/zip', disposition: contentDisposition('attachment', fileName) });

/** Downloads of Mein Bereich (M-6): membership is enough, only visible scores (R-2). */
@Controller(ME.base)
export class DownloadsController {
  constructor(@Inject(DownloadsService) private readonly downloads: DownloadsService) {}

  @Get(ME.sheetPdf.path)
  async sheetPdf(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(sheetParamsSchema)) p: { sheetId: string },
    @Query(new Zod(sheetPdfQuerySchema)) q: SheetPdfQuery,
  ): Promise<StreamableFile> {
    const file = await this.downloads.sheet(access, p.sheetId, q.folderId);
    return new StreamableFile(file.body, { type: 'application/pdf', disposition: contentDisposition(q.disposition, file.fileName) });
  }

  @Get(ME.folderZip.path)
  async folderZip(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(folderParamsSchema)) p: { folderId: string },
    @Query(new Zod(zipQuerySchema)) q: ZipQuery,
  ): Promise<StreamableFile> {
    const file = await this.downloads.zip(access, { kind: 'folder', folderId: p.folderId }, q.voiceId, q.substitutes);
    return zipFile(file.body, file.fileName);
  }

  @Get(ME.eventZip.path)
  async eventZip(
    @CurrentAccess() access: AccessContext,
    @Param(new Zod(eventParamsSchema)) p: { eventId: string },
    @Query(new Zod(zipQuerySchema)) q: ZipQuery,
  ): Promise<StreamableFile> {
    const file = await this.downloads.zip(access, { kind: 'event', eventId: p.eventId }, q.voiceId, q.substitutes);
    return zipFile(file.body, file.fileName);
  }

  /** POST because of the long id list; changes nothing. */
  @Post(ME.selectionZip.path)
  @HttpCode(200)
  async selectionZip(@CurrentAccess() access: AccessContext, @Body(new Zod(selectionZipBodySchema)) body: SelectionZipBody): Promise<StreamableFile> {
    const file = await this.downloads.zip(
      access,
      { kind: 'selection', scoreIds: body.scoreIds, folderId: body.folderId, eventId: body.eventId },
      body.voiceIds,
      body.substitutes,
    );
    return zipFile(file.body, file.fileName);
  }
}

/** Printing (D-1..D-3, D-7): every member, no own permission; visibility as in F-9. */
@Controller(PRINT.base)
export class PrintController {
  constructor(@Inject(DownloadsService) private readonly downloads: DownloadsService) {}

  @Get(PRINT.printPlan.path)
  @ResponseSchema(printPlanResponseSchema)
  plan(@CurrentAccess() access: AccessContext, @Query(new Zod(printQuerySchema)) q: PrintQuery) {
    return this.downloads.printPlan(access, q);
  }

  @Get(PRINT.printDocument.path)
  async document(@CurrentAccess() access: AccessContext, @Query(new Zod(printDocumentQuerySchema)) q: PrintQuery): Promise<StreamableFile> {
    const file = await this.downloads.printDocument(access, q);
    return new StreamableFile(file.body, { type: 'application/pdf', disposition: contentDisposition('inline', file.fileName) });
  }
}
