import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import {
  API_ROUTES,
  clubTagListQuerySchema,
  clubTagListResponseSchema,
  createClubTagBodySchema,
  createdResponseSchema,
  renameBodySchema,
  tagParamsSchema,
  type ClubTagListQuery,
  type CreateClubTagBody,
  type RenameBody,
} from '@vm-web/shared';
import { RequirePermission } from '../access/decorators';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe as Zod } from '../common/validation/zod-validation.pipe';
import { TagsService } from './tags.service';

const R = API_ROUTES.tags;

@Controller(R.base)
export class TagsController {
  constructor(@Inject(TagsService) private readonly tags: TagsService) {}

  @RequirePermission('tag.view')
  @Get(R.clubTagList.path)
  @ResponseSchema(clubTagListResponseSchema)
  list(@Query(new Zod(clubTagListQuerySchema)) q: ClubTagListQuery) {
    return this.tags.list(q);
  }

  @RequirePermission('tag.create')
  @Post(R.createTag.path)
  @ResponseSchema(createdResponseSchema)
  create(@Body(new Zod(createClubTagBodySchema)) body: CreateClubTagBody) {
    return this.tags.create(body.name);
  }

  @RequirePermission('tag.edit')
  @Post(R.renameTag.path)
  @HttpCode(204)
  async rename(@Param(new Zod(tagParamsSchema)) p: { tagId: string }, @Body(new Zod(renameBodySchema)) body: RenameBody) {
    await this.tags.rename(p.tagId, body.name);
  }

  @RequirePermission('tag.delete')
  @Post(R.deleteTag.path)
  @HttpCode(204)
  async delete(@Param(new Zod(tagParamsSchema)) p: { tagId: string }) {
    await this.tags.delete(p.tagId);
  }
}
