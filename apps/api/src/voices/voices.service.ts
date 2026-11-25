import { Inject, Injectable } from '@nestjs/common';
import type { CreateVoiceBody, CreateVoiceResponse, InstrumentSuggestionsResponse, VoiceListResponse } from '@vm-web/shared';
import { ProblemException } from '../common/problem-details/problem.exception';
import { VoicesRepository } from './voices.repository';

const MAX_INSTRUMENT_SUGGESTIONS = 20;

@Injectable()
export class VoicesService {
  constructor(@Inject(VoicesRepository) private readonly repo: VoicesRepository) {}

  async list(): Promise<VoiceListResponse> {
    const { rows, substitutes, sheetCounts, lineupCounts } = await this.repo.catalog();
    const sheetCountMap = new Map(sheetCounts.map((s) => [s.voiceId, s.n]));
    const lineupCountMap = new Map(lineupCounts.map((l) => [l.voiceId, l.n]));

    const groups: VoiceListResponse['groups'] = [];
    for (const r of rows) {
      let group = groups.at(-1);
      if (group?.instrument.id !== r.instrument.id) {
        group = { instrument: { ...r.instrument, voiceCount: 0 }, voices: [] };
        groups.push(group);
      }
      group.instrument.voiceCount++;
      group.voices.push({
        ...r.voice,
        substitutes: substitutes.filter((s) => s.voiceId === r.voice.id).map(({ id, name, instrumentId }) => ({ id, name, instrumentId })),
        sheetCount: sheetCountMap.get(r.voice.id) ?? 0,
        lineupCount: lineupCountMap.get(r.voice.id) ?? 0,
      });
    }
    return { groups };
  }

  async instrumentSuggestions(q: string): Promise<InstrumentSuggestionsResponse> {
    return { items: await this.repo.instrumentSuggestions(q, MAX_INSTRUMENT_SUGGESTIONS) };
  }

  create(body: CreateVoiceBody): Promise<CreateVoiceResponse> {
    return this.repo.createVoice(body.name, body.instrumentName);
  }

  update(voiceId: string, body: CreateVoiceBody): Promise<void> {
    return this.repo.updateVoice(voiceId, body.name, body.instrumentName);
  }

  setSubstitutes(voiceId: string, substituteIds: readonly string[]): Promise<void> {
    const errors = substituteIds.flatMap((id, i) =>
      id === voiceId ? [{ path: `/body/substituteVoiceIds/${i}`, code: 'self_reference' }] : substituteIds.indexOf(id) !== i ? [{ path: `/body/substituteVoiceIds/${i}`, code: 'duplicate' }] : [],
    );
    if (errors.length) throw ProblemException.validation(errors);
    return this.repo.replaceSubstitutes(voiceId, substituteIds);
  }

  delete(voiceId: string): Promise<void> {
    return this.repo.deleteUnusedVoice(voiceId);
  }

  renameInstrument(instrumentId: string, name: string): Promise<void> {
    return this.repo.renameInstrument(instrumentId, name);
  }

  reorderInstruments(ids: readonly string[]): Promise<void> {
    return this.repo.reorderInstruments(ids);
  }

  reorderVoices(instrumentId: string, ids: readonly string[]): Promise<void> {
    return this.repo.reorderVoices(instrumentId, ids);
  }
}
