import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, StreamableFile } from '@nestjs/common';
import {
  API_ROUTES,
  approveUploadBodySchema,
  approveUploadResponseSchema,
  rejectUploadBodySchema,
  rejectUploadResponseSchema,
  reviewQueueQuerySchema,
  reviewQueueResponseSchema,
  uploadDetailsResponseSchema,
  uploadParamsSchema,
  type ApproveUploadBody,
  type CursorQuery,
  type RejectUploadBody,
} from '@vm-web/shared';
import type { AccessContext } from '../access/access-context';
import { CurrentAccess, RequirePermission } from '../access/decorators';
import { contentDisposition } from '../common/files/download-names';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe as Zod } from '../common/validation/zod-validation.pipe';
import { ReviewService } from './review.service';

const R = API_ROUTES.review;
type UploadParams = { uploadId: string };

/** Review screen (N-12, N-13). Everything needs `sheet.approve` in at least one ensemble (F-4). */
@RequirePermission('sheet.approve')
@Controller(R.base)
export class ReviewController {
  constructor(@Inject(ReviewService) private readonly review: ReviewService) {}

  @Get(R.queue.path)
  @ResponseSchema(reviewQueueResponseSchema)
  queue(@Query(new Zod(reviewQueueQuerySchema)) q: CursorQuery) {
    return this.review.queue(q);
  }

  @Get(R.uploadDetails.path)
  @ResponseSchema(uploadDetailsResponseSchema)
  details(@Param(new Zod(uploadParamsSchema)) p: UploadParams) {
    return this.review.details(p.uploadId);
  }

  @Get(R.uploadPdf.path)
  async pdf(@Param(new Zod(uploadParamsSchema)) p: UploadParams): Promise<StreamableFile> {
    const { stream, fileName } = await this.review.originalFile(p.uploadId);
    return new StreamableFile(stream, { type: 'application/pdf', disposition: contentDisposition('inline', fileName) });
  }

  @Post(R.approve.path)
  @HttpCode(200)
  @ResponseSchema(approveUploadResponseSchema)
  approve(@CurrentAccess() access: AccessContext, @Param(new Zod(uploadParamsSchema)) p: UploadParams, @Body(new Zod(approveUploadBodySchema)) body: ApproveUploadBody) {
    return this.review.approve(access, p.uploadId, body);
  }

  @Post(R.reject.path)
  @HttpCode(200)
  @ResponseSchema(rejectUploadResponseSchema)
  reject(@CurrentAccess() access: AccessContext, @Param(new Zod(uploadParamsSchema)) p: UploadParams, @Body(new Zod(rejectUploadBodySchema)) body: RejectUploadBody) {
    return this.review.reject(access.userId, p.uploadId, body.reason);
  }
}
