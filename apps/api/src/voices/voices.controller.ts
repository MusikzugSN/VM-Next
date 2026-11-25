import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import {
  API_ROUTES,
  createVoiceBodySchema,
  createVoiceResponseSchema,
  instrumentParamsSchema,
  instrumentSuggestionsQuerySchema,
  instrumentSuggestionsResponseSchema,
  renameBodySchema,
  reorderInstrumentsBodySchema,
  reorderVoicesBodySchema,
  setSubstitutesBodySchema,
  updateVoiceBodySchema,
  voiceListResponseSchema,
  voiceParamsSchema,
  type CreateVoiceBody,
  type InstrumentSuggestionsQuery,
  type RenameBody,
  type ReorderInstrumentsBody,
  type ReorderVoicesBody,
  type SetSubstitutesBody,
} from '@vm-web/shared';
import { RequirePermission } from '../access/decorators';
import { ResponseSchema } from '../common/validation/zod-response.interceptor';
import { ZodValidationPipe as Zod } from '../common/validation/zod-validation.pipe';
import { VoicesService } from './voices.service';

const R = API_ROUTES.voices;

@Controller(R.base)
export class VoicesController {
  constructor(@Inject(VoicesService) private readonly voices: VoicesService) {}

  @RequirePermission('voice.view')
  @Get(R.voiceList.path)
  @ResponseSchema(voiceListResponseSchema)
  list() {
    return this.voices.list();
  }

  @RequirePermission(['voice.create', 'voice.edit'])
  @Get(R.instrumentSuggestions.path)
  @ResponseSchema(instrumentSuggestionsResponseSchema)
  instrumentSuggestions(@Query(new Zod(instrumentSuggestionsQuerySchema)) q: InstrumentSuggestionsQuery) {
    return this.voices.instrumentSuggestions(q.q);
  }

  @RequirePermission('voice.create')
  @Post(R.createVoice.path)
  @ResponseSchema(createVoiceResponseSchema)
  create(@Body(new Zod(createVoiceBodySchema)) body: CreateVoiceBody) {
    return this.voices.create(body);
  }

  @RequirePermission('voice.edit')
  @Post(R.updateVoice.path)
  @HttpCode(204)
  async update(@Param(new Zod(voiceParamsSchema)) p: { voiceId: string }, @Body(new Zod(updateVoiceBodySchema)) body: CreateVoiceBody) {
    await this.voices.update(p.voiceId, body);
  }

  @RequirePermission('voice.edit')
  @Post(R.setSubstitutes.path)
  @HttpCode(204)
  async setSubstitutes(@Param(new Zod(voiceParamsSchema)) p: { voiceId: string }, @Body(new Zod(setSubstitutesBodySchema)) body: SetSubstitutesBody) {
    await this.voices.setSubstitutes(p.voiceId, body.substituteVoiceIds);
  }

  @RequirePermission('voice.delete')
  @Post(R.deleteVoice.path)
  @HttpCode(204)
  async delete(@Param(new Zod(voiceParamsSchema)) p: { voiceId: string }) {
    await this.voices.delete(p.voiceId);
  }

  @RequirePermission('voice.edit')
  @Post(R.renameInstrument.path)
  @HttpCode(204)
  async renameInstrument(@Param(new Zod(instrumentParamsSchema)) p: { instrumentId: string }, @Body(new Zod(renameBodySchema)) body: RenameBody) {
    await this.voices.renameInstrument(p.instrumentId, body.name);
  }

  @RequirePermission('voice.edit')
  @Post(R.reorderInstruments.path)
  @HttpCode(204)
  async reorderInstruments(@Body(new Zod(reorderInstrumentsBodySchema)) body: ReorderInstrumentsBody) {
    await this.voices.reorderInstruments(body.instrumentIds);
  }

  @RequirePermission('voice.edit')
  @Post(R.reorderVoices.path)
  @HttpCode(204)
  async reorderVoices(@Param(new Zod(instrumentParamsSchema)) p: { instrumentId: string }, @Body(new Zod(reorderVoicesBodySchema)) body: ReorderVoicesBody) {
    await this.voices.reorderVoices(p.instrumentId, body.voiceIds);
  }
}
