import { Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import {
  acceptLegalTemplateBodySchema,
  API_ROUTES,
  legalPreviewBodySchema,
  legalPreviewResponseSchema,
  legalSettingsResponseSchema,
  legalStatusResponseSchema,
  publicLegalDocumentResponseSchema,
  updateLegalSettingsBodySchema,
  type AcceptLegalTemplateBody,
  type LegalDocument,
  type LegalPreviewBody,
  type UpdateLegalSettingsBody,
} from '@vm-web/shared';
import type { Response } from 'express';
import { Public, RequirePermission } from '../access/decorators';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe as Zod } from '../common/validation/zod-validation.pipe';
import { LegalService } from './legal.service';

const P = API_ROUTES.publicLegal;
const S = API_ROUTES.system;

/**
 * Public imprint and privacy policy (S-7). Cached, but revalidated on every request (`no-cache`):
 * Express adds a weak `ETag` and answers `304` itself, so a change is visible at once.
 */
@Controller(P.base)
export class PublicLegalController {
  constructor(@Inject(LegalService) private readonly legal: LegalService) {}

  @Public()
  @Get(P.imprint.path)
  @ResponseSchema(publicLegalDocumentResponseSchema)
  imprint(@Res({ passthrough: true }) res: Response) {
    return this.document('imprint', res);
  }

  @Public()
  @Get(P.privacy.path)
  @ResponseSchema(publicLegalDocumentResponseSchema)
  privacy(@Res({ passthrough: true }) res: Response) {
    return this.document('privacy', res);
  }

  private document(document: LegalDocument, res: Response) {
    res.setHeader('Cache-Control', 'public, no-cache');
    return this.legal.publicDocument(document);
  }
}

/** Tab „Rechtliches“ of the configuration (S-7); the configuration permission applies club-wide. */
@Controller(S.base)
export class SystemLegalController {
  constructor(@Inject(LegalService) private readonly legal: LegalService) {}

  @RequirePermission('config.view')
  @Get(S.legalSettings.path)
  @ResponseSchema(legalSettingsResponseSchema)
  settings() {
    return this.legal.settings();
  }

  @RequirePermission('config.view')
  @Get(S.legalStatus.path)
  @ResponseSchema(legalStatusResponseSchema)
  status() {
    return this.legal.status();
  }

  @RequirePermission('config.edit')
  @Post(S.updateLegalSettings.path)
  @HttpCode(204)
  async update(@Body(new Zod(updateLegalSettingsBodySchema)) body: UpdateLegalSettingsBody) {
    await this.legal.update(body);
  }

  @RequirePermission('config.edit')
  @Post(S.legalPreview.path)
  @HttpCode(200)
  @ResponseSchema(legalPreviewResponseSchema)
  preview(@Body(new Zod(legalPreviewBodySchema)) body: LegalPreviewBody) {
    return this.legal.preview(body);
  }

  @RequirePermission('config.edit')
  @Post(S.acceptLegalTemplate.path)
  @HttpCode(204)
  async accept(@Body(new Zod(acceptLegalTemplateBodySchema)) body: AcceptLegalTemplateBody) {
    await this.legal.acceptTemplate(body);
  }
}
