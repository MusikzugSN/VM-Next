import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import {
  API_ROUTES,
  createdResponseSchema,
  createEventBodySchema,
  ensembleOptionsResponseSchema,
  eventDetailsResponseSchema,
  eventListQuerySchema,
  eventListResponseSchema,
  eventParamsSchema,
  eventScoreCandidatesQuerySchema,
  eventScoreCandidatesResponseSchema,
  setlistQuerySchema,
  setlistResponseSchema,
  setSetlistBodySchema,
  setVisibilityBodySchema,
  updateEventDetailsBodySchema,
  type CreateEventBody,
  type CursorQuery,
  type EventListQuery,
  type SetSetlistBody,
  type SetVisibilityBody,
  type UpdateEventDetailsBody,
} from '@vm-web/shared';
import type { AccessContext } from '../access/access-context';
import { CurrentAccess, RequireMember, RequirePermission, type EnsembleSource } from '../access/decorators';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe as Zod } from '../common/validation/zod-validation.pipe';
import { EventsService } from './events.service';

const R = API_ROUTES.events;
const OF_EVENT: EnsembleSource = { resolver: 'event', from: 'param:eventId' };
type EventParams = { eventId: string };

/** Events belong to an ensemble → `event.*` in that ensemble or a parent (R-4, F-3). */
@Controller(R.base)
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  /** Requires `event.create` in at least one ensemble (checked in the service). */
  @RequireMember()
  @Get(R.ensembleOptions.path)
  @ResponseSchema(ensembleOptionsResponseSchema)
  ensembleOptions(@CurrentAccess() access: AccessContext) {
    return this.events.ensembleOptions(access);
  }

  /** Filtered to ensembles with `event.view`. */
  @RequireMember()
  @Get(R.eventList.path)
  @ResponseSchema(eventListResponseSchema)
  list(@CurrentAccess() access: AccessContext, @Query(new Zod(eventListQuerySchema)) q: EventListQuery) {
    return this.events.list(access, q);
  }

  @RequirePermission('event.view', { ensembleFrom: OF_EVENT })
  @Get(R.eventDetails.path)
  @ResponseSchema(eventDetailsResponseSchema)
  details(@Param(new Zod(eventParamsSchema)) p: EventParams) {
    return this.events.details(p.eventId);
  }

  @RequirePermission('event.view', { ensembleFrom: OF_EVENT })
  @Get(R.setlist.path)
  @ResponseSchema(setlistResponseSchema)
  setlist(@Param(new Zod(eventParamsSchema)) p: EventParams, @Query(new Zod(setlistQuerySchema)) q: CursorQuery) {
    return this.events.setlist(p.eventId, q);
  }

  @RequirePermission('event.edit', { ensembleFrom: OF_EVENT })
  @Get(R.scoreCandidates.path)
  @ResponseSchema(eventScoreCandidatesResponseSchema)
  candidates(@Param(new Zod(eventParamsSchema)) p: EventParams, @Query(new Zod(eventScoreCandidatesQuerySchema)) q: { q: string; cursor?: string; limit: number }) {
    return this.events.candidates(p.eventId, q);
  }

  @RequirePermission('event.create', { ensembleFrom: 'body:ensembleId' })
  @Post(R.createEvent.path)
  @ResponseSchema(createdResponseSchema)
  create(@Body(new Zod(createEventBodySchema)) body: CreateEventBody) {
    return this.events.create(body);
  }

  @RequirePermission('event.edit', { ensembleFrom: OF_EVENT })
  @Post(R.updateDetails.path)
  @HttpCode(204)
  async updateDetails(@Param(new Zod(eventParamsSchema)) p: EventParams, @Body(new Zod(updateEventDetailsBodySchema)) body: UpdateEventDetailsBody) {
    await this.events.updateDetails(p.eventId, body);
  }

  @RequirePermission('event.edit', { ensembleFrom: OF_EVENT })
  @Post(R.setVisibility.path)
  @HttpCode(204)
  async setVisibility(@Param(new Zod(eventParamsSchema)) p: EventParams, @Body(new Zod(setVisibilityBodySchema)) body: SetVisibilityBody) {
    await this.events.setVisibility(p.eventId, body.showInMyArea);
  }

  @RequirePermission('event.edit', { ensembleFrom: OF_EVENT })
  @Post(R.setSetlist.path)
  @HttpCode(204)
  async setSetlist(@Param(new Zod(eventParamsSchema)) p: EventParams, @Body(new Zod(setSetlistBodySchema)) body: SetSetlistBody) {
    await this.events.setSetlist(p.eventId, body.scoreIds);
  }

  @RequirePermission('event.delete', { ensembleFrom: OF_EVENT })
  @Post(R.deleteEvent.path)
  @HttpCode(204)
  async delete(@Param(new Zod(eventParamsSchema)) p: EventParams) {
    await this.events.delete(p.eventId);
  }
}
