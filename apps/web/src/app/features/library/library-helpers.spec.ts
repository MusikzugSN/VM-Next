import type { FieldDefinition, ScoreCompletenessResponse, VoiceListResponse } from '@vm-web/shared';

import { buildScoreBody, emptyScoreForm, scoreFormFromDetails } from './scores/score-form-model';
import { groupCompleteness } from './scores/score-page';
import {
  activeFilterCount,
  describeFilter,
  draftFromFilters,
  filtersFromDraft,
  formatDuration,
  parseDuration,
  parseScoreQuery,
  scoreQueryParams,
  scoreTableQuery,
} from './scores/score-query';
import { moveItem } from './voices/voice-dialog';
import { filterVoiceList } from './voices/voices-page';

const fields: FieldDefinition[] = [
  { id: '0190a1b2-0000-7000-8000-000000000001', name: 'Schwierigkeitsgrad', type: 'number', required: false, position: 1, options: [] },
  { id: 'f-arch', name: 'Archivnummer', type: 'text', required: true, position: 2, options: [] },
  {
    id: 'f-cast',
    name: 'Besetzung',
    type: 'select',
    required: false,
    position: 3,
    options: [
      { id: 'o1', label: 'Blasorchester' },
      { id: 'o2', label: 'Kleine Besetzung' },
    ],
  },
  { id: 'f-solo', name: 'Solo', type: 'boolean', required: false, position: 4, options: [] },
  { id: 'f-date', name: 'Gekauft', type: 'date', required: false, position: 5, options: [] },
];
const labels = { composer: 'Komponist', publisher: 'Verlag', yes: 'Ja', no: 'Nein' };

describe('score table query (N-3)', () => {
  it('round-trips through URL parameters and leaves defaults out', () => {
    const state = parseScoreQuery({
      q: 'marsch',
      sort: 'field:0190a1b2-0000-7000-8000-000000000001',
      dir: 'desc',
      tagId: 't1',
      filter: JSON.stringify([{ column: 'composer', op: 'contains', value: 'Gälle' }]),
    });
    expect(state).toEqual({
      q: 'marsch',
      sort: 'field:0190a1b2-0000-7000-8000-000000000001',
      dir: 'desc',
      tagId: 't1',
      ensembleId: null,
      filters: [{ column: 'composer', op: 'contains', value: 'Gälle' }],
    });
    expect(parseScoreQuery(scoreQueryParams(state))).toEqual(state);
    expect(scoreQueryParams(parseScoreQuery({}))).toEqual({ q: null, sort: null, dir: null, tagId: null, ensembleId: null, filter: null });
    expect(activeFilterCount(state)).toBe(2);
  });

  it('ignores broken or unknown parameters', () => {
    const state = parseScoreQuery({ sort: 'evil', dir: 'sideways', filter: '{not json' });
    expect(state.sort).toBe('title');
    expect(state.dir).toBe('asc');
    expect(state.filters).toEqual([]);
  });

  it('builds the API query', () => {
    expect(scoreTableQuery({ ...parseScoreQuery({}), q: '  ' })).toEqual({
      q: undefined,
      sort: 'title',
      dir: 'asc',
      tagId: undefined,
      ensembleId: undefined,
      filter: undefined,
    });
  });
});

describe('filter dialog (N-3)', () => {
  it('turns inputs into conditions and back', () => {
    const draft = draftFromFilters([], fields);
    draft['composer'] = { kind: 'text', contains: ' Gälle ' };
    draft['field:0190a1b2-0000-7000-8000-000000000001'] = { kind: 'range', from: '2', to: '5' };
    draft['field:f-cast'] = { kind: 'options', ids: ['o2'] };
    draft['field:f-solo'] = { kind: 'boolean', value: 'false' };
    draft['field:f-date'] = { kind: 'range', from: '2020-01-01', to: '' };
    const filters = filtersFromDraft(draft, fields);
    expect(filters).toEqual([
      { column: 'composer', op: 'contains', value: 'Gälle' },
      { column: 'field:0190a1b2-0000-7000-8000-000000000001', op: 'between', value: [2, 5] },
      { column: 'field:f-cast', op: 'in', value: ['o2'] },
      { column: 'field:f-solo', op: 'eq', value: false },
      { column: 'field:f-date', op: 'between', value: ['2020-01-01', '9999-12-31'] },
    ]);
    const back = draftFromFilters(filters, fields);
    expect(back['field:f-date']).toEqual({ kind: 'range', from: '2020-01-01', to: '' });
    expect(back['field:0190a1b2-0000-7000-8000-000000000001']).toEqual({ kind: 'range', from: '2', to: '5' });
    expect(filtersFromDraft(back, fields)).toEqual(filters);
  });

  it('describes conditions for the chips', () => {
    expect(describeFilter({ column: 'field:0190a1b2-0000-7000-8000-000000000001', op: 'between', value: [2, 5] }, fields, labels)).toBe('Schwierigkeitsgrad 2–5');
    expect(describeFilter({ column: 'field:0190a1b2-0000-7000-8000-000000000001', op: 'between', value: [3, 1_000_000_000] }, fields, labels)).toBe('Schwierigkeitsgrad ≥ 3');
    expect(describeFilter({ column: 'field:f-cast', op: 'in', value: ['o1', 'o2'] }, fields, labels)).toBe('Besetzung: Blasorchester, Kleine Besetzung');
    expect(describeFilter({ column: 'publisher', op: 'contains', value: 'Rundel' }, fields, labels)).toBe('Verlag: „Rundel“');
    expect(describeFilter({ column: 'field:f-solo', op: 'eq', value: true }, fields, labels)).toBe('Solo: Ja');
  });
});

describe('duration', () => {
  it.each([
    ['3:40', 220],
    ['12:05', 725],
    ['3', 180],
    ['', null],
  ])('parses %s', (text, seconds) => {
    expect(parseDuration(text)).toBe(seconds);
  });

  it('rejects invalid input and formats seconds', () => {
    expect(parseDuration('3:75')).toBeNaN();
    expect(parseDuration('abc')).toBeNaN();
    expect(formatDuration(190)).toBe('3:10');
    expect(formatDuration(null)).toBe('');
  });
});

describe('score form (N-1, N-2)', () => {
  it('reports missing required fields and bad input with API field paths', () => {
    const form = { ...emptyScoreForm(), duration: 'lang', custom: { '0190a1b2-0000-7000-8000-000000000001': 'drei' } };
    expect(buildScoreBody(form, fields).errors).toEqual({
      title: 'required',
      durationSeconds: 'invalid_format',
      'customFields/0190a1b2-0000-7000-8000-000000000001': 'invalid_type',
      'customFields/f-arch': 'required',
    });
  });

  it('builds the body with typed custom values', () => {
    const form = {
      ...emptyScoreForm(),
      title: ' Florentiner Marsch ',
      composer: 'Julius Fučík',
      duration: '3:10',
      tagIds: ['t1'],
      custom: { '0190a1b2-0000-7000-8000-000000000001': '3,5', 'f-arch': 'HO-0017', 'f-cast': 'o1', 'f-solo': true },
    };
    const { body, errors } = buildScoreBody(form, fields);
    expect(errors).toEqual({});
    expect(body).toEqual({
      title: 'Florentiner Marsch',
      composer: 'Julius Fučík',
      arranger: null,
      publisher: null,
      publisherNumber: null,
      durationSeconds: 190,
      tagIds: ['t1'],
      customFields: { '0190a1b2-0000-7000-8000-000000000001': 3.5, 'f-arch': 'HO-0017', 'f-cast': 'o1', 'f-solo': true, 'f-date': null },
    });
  });

  it('fills the form from the details', () => {
    const form = scoreFormFromDetails(
      {
        id: 's1',
        title: 'T',
        composer: null,
        arranger: null,
        publisher: 'Rundel',
        publisherNumber: null,
        durationSeconds: 210,
        customFields: { '0190a1b2-0000-7000-8000-000000000001': 3, 'f-solo': true },
        tags: [{ id: 't1', name: 'Marsch' }],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      fields,
    );
    expect(form).toMatchObject({ publisher: 'Rundel', duration: '3:30', tagIds: ['t1'], custom: { '0190a1b2-0000-7000-8000-000000000001': '3', 'f-solo': true, 'f-arch': '' } });
  });
});

describe('completeness groups (N-4, N-6)', () => {
  it('groups lineup voices by instrument in lineup order', () => {
    const voice = (id: string, instrumentId: string) => ({ id, name: id, instrumentId });
    const completeness: ScoreCompletenessResponse = {
      ensemble: { id: 'e1', name: 'Hauptorchester' },
      summary: { present: 2, substituted: 1, total: 4 },
      voices: [
        { voice: voice('tp1', 'tp'), status: 'present', sheetId: 's1', substitute: null },
        { voice: voice('kl1', 'kl'), status: 'missing', sheetId: null, substitute: null },
        { voice: voice('tp2', 'tp'), status: 'substituted', sheetId: null, substitute: voice('tp1', 'tp') },
        { voice: voice('kl2', 'kl'), status: 'present', sheetId: 's2', substitute: null },
      ],
    };
    const groups = groupCompleteness(completeness, new Map([['tp', 'Trompete'], ['kl', 'Klarinette']]));
    expect(groups.map((g) => [g.name, g.present, g.voices.length])).toEqual([
      ['Trompete', 1, 2],
      ['Klarinette', 1, 2],
    ]);
  });
});

describe('voices (N-6, F-16)', () => {
  const groups: VoiceListResponse['groups'] = [
    {
      instrument: { id: 'tp', name: 'Trompete', voiceCount: 2 },
      voices: [
        { id: 'tp1', name: 'Trompete 1 in B', substitutes: [{ id: 'flh', name: 'Flügelhorn 1 in B', instrumentId: 'flh' }], sheetCount: 3, lineupCount: 1 },
        { id: 'tp2', name: 'Trompete 2 in B', substitutes: [], sheetCount: 1, lineupCount: 1 },
      ],
    },
    { instrument: { id: 'kl', name: 'Klarinette', voiceCount: 1 }, voices: [{ id: 'kl1', name: 'Klarinette 1 in B', substitutes: [], sheetCount: 0, lineupCount: 0 }] },
  ];

  it('filters by instrument, voice and substitute names', () => {
    expect(filterVoiceList(groups, 'klar').map((g) => g.instrument.id)).toEqual(['kl']);
    expect(filterVoiceList(groups, 'flügel')[0].voices.map((v) => v.id)).toEqual(['tp1']);
    expect(filterVoiceList(groups, '')).toHaveLength(2);
  });

  it('moves items one step and stays within bounds', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});
