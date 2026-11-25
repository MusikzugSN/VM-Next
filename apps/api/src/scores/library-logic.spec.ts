import type { VoiceRef } from '@vm-web/shared';
import { join } from 'node:path';
import { csvCell, csvLine } from '../common/files/csv';
import { contentDisposition, sheetFileName, uniqueNames } from '../common/files/download-names';
import { loadLineupTemplate, lineupTemplateSchema } from '../seed/lineup-template';
import { completenessOf } from './completeness';
import { displayValue, pruneValues, validateCustomValues, type FieldDef } from './custom-fields';

const OPT_EASY = '00000000-0000-7000-8000-00000000000a';
const OPT_HARD = '00000000-0000-7000-8000-00000000000b';
const def = (id: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}): FieldDef => ({
  id,
  name: id,
  type,
  required: false,
  options: type === 'select' || type === 'multiselect' ? [{ id: OPT_EASY, label: 'leicht' }, { id: OPT_HARD, label: 'schwer' }] : [],
  ...extra,
});
const FIELDS = [
  def('text', 'text'),
  def('num', 'number'),
  def('date', 'date'),
  def('sel', 'select'),
  def('multi', 'multiselect'),
  def('link', 'link'),
  def('bool', 'boolean'),
  def('archive', 'text', { required: true }),
];

describe('validateCustomValues (N-2)', () => {
  it('accepts valid values, trims text and drops empty ones', () => {
    const { values, errors } = validateCustomValues(FIELDS, {
      text: '  Hörprobe  ',
      num: 3,
      date: '2026-11-17',
      sel: OPT_EASY,
      multi: [OPT_HARD, OPT_HARD],
      link: 'https://example.org/audio',
      bool: false,
      archive: 'A-17',
    });
    expect(errors).toEqual([]);
    expect(values).toEqual({
      text: 'Hörprobe',
      num: 3,
      date: '2026-11-17',
      sel: OPT_EASY,
      multi: [OPT_HARD],
      link: 'https://example.org/audio',
      bool: false,
      archive: 'A-17',
    });
    expect(validateCustomValues(FIELDS, { archive: 'x', text: '   ', multi: [] }).values).toEqual({ archive: 'x' });
  });

  it('reports type errors, unknown options, unknown fields and missing required values with pointers', () => {
    const { errors } = validateCustomValues(FIELDS, {
      num: '3',
      date: '17.11.2026',
      sel: '00000000-0000-7000-8000-0000000000ff',
      link: 'javascript:alert(1)',
      bool: 'yes',
      nope: 1,
    });
    expect(errors).toEqual([
      { path: '/body/customFields/nope', code: 'unknown_field' },
      { path: '/body/customFields/num', code: 'invalid_type' },
      { path: '/body/customFields/date', code: 'invalid_format' },
      { path: '/body/customFields/sel', code: 'invalid_option' },
      { path: '/body/customFields/link', code: 'invalid_format' },
      { path: '/body/customFields/bool', code: 'invalid_type' },
      { path: '/body/customFields/archive', code: 'required' },
    ]);
  });

  it('prunes values of deleted options and renders display values', () => {
    const onlyEasy = def('multi', 'multiselect', { options: [{ id: OPT_EASY, label: 'leicht' }] });
    expect(pruneValues(onlyEasy, [OPT_EASY, OPT_HARD])).toEqual([OPT_EASY]);
    expect(pruneValues(onlyEasy, [OPT_HARD])).toBeNull();
    expect(pruneValues(def('sel', 'select', { options: [] }), OPT_EASY)).toBeNull();
    expect(displayValue(def('multi', 'multiselect'), [OPT_EASY, OPT_HARD])).toBe('leicht, schwer');
    expect(displayValue(def('bool', 'boolean'), true)).toBe('true');
    expect(displayValue(def('num', 'number'), undefined)).toBe('');
  });
});

describe('completenessOf (N-4, N-9, F-5)', () => {
  const v = (id: string): VoiceRef => ({ id, name: id, instrumentId: 'i' });
  it('counts own sheets as present and substitutes separately', () => {
    const lineup = [v('fl1'), v('hn1-f'), v('tb-c'), v('tp1')];
    const subs = new Map([
      ['hn1-f', [v('hn1-es')]],
      ['tb-c', [v('tb-b'), v('tb-es')]],
    ]);
    const sheets = new Map([
      ['fl1', 's1'],
      ['hn1-es', 's2'],
      ['tb-es', 's3'],
    ]);
    const r = completenessOf(lineup, subs, sheets);
    expect(r.summary).toEqual({ present: 1, substituted: 2, total: 4 });
    expect(r.voices.map((x) => [x.voice.id, x.status, x.substitute?.id ?? null, x.sheetId])).toEqual([
      ['fl1', 'present', null, 's1'],
      ['hn1-f', 'substituted', 'hn1-es', 's2'],
      ['tb-c', 'substituted', 'tb-es', 's3'],
      ['tp1', 'missing', null, null],
    ]);
  });

  it('is 0/0 without lineup', () => {
    expect(completenessOf([], new Map(), new Map()).summary).toEqual({ present: 0, substituted: 0, total: 0 });
  });
});

describe('download names (M-6)', () => {
  it('builds „Nr – Titel – Stimme.pdf“ and leaves out a missing number', () => {
    expect(sheetFileName({ number: '12', title: 'Böhmischer Traum', voice: 'Trompete 1 in B' })).toBe('12 – Böhmischer Traum – Trompete 1 in B.pdf');
    expect(sheetFileName({ title: 'Alte Kameraden', voice: 'Horn 1 in F' })).toBe('Alte Kameraden – Horn 1 in F.pdf');
  });

  it('limits the length of the base name', () => {
    expect(sheetFileName({ title: 'x'.repeat(300), voice: 'Tuba' })).toHaveLength(154);
  });

  it('makes names unique within a ZIP', () => {
    expect(uniqueNames(['a.pdf', 'A.pdf', 'b.pdf', 'a.pdf'])).toEqual(['a.pdf', 'A (2).pdf', 'b.pdf', 'a (3).pdf']);
  });

  it('writes Content-Disposition with ASCII fallback and UTF-8 name', () => {
    expect(contentDisposition('attachment', 'Böhmischer Traum.pdf')).toBe(
      `attachment; filename="Bohmischer Traum.pdf"; filename*=UTF-8''B%C3%B6hmischer%20Traum.pdf`,
    );
  });
});

describe('CSV (N-3, F-10)', () => {
  it('quotes separators and neutralizes formulas', () => {
    expect(csvLine(['a;b', 'say "hi"', 3, null, '=HYPERLINK("x")', '-5', -5])).toBe(
      `"a;b";"say ""hi""";3;;"'=HYPERLINK(""x"")";'-5;-5\r\n`,
    );
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
});

describe('lineup template (N-8)', () => {
  it('ships a valid Standard-Blasorchester template', async () => {
    const t = await loadLineupTemplate(join(__dirname, '../../defaults/lineup.default.json'));
    expect(t.name).toBe('Standard-Blasorchester');
    const lineup = t.instruments.flatMap((i) => i.voices.filter((v) => v.lineup).map((v) => v.name));
    expect(lineup).toContain('Trompete 1 in B');
    expect(lineup).not.toContain('Horn 1 in Es');
    expect(t.substitutes['Horn 1 in F']).toEqual(['Horn 1 in Es']);
  });

  it('rejects substitutes that reference unknown voices', () => {
    expect(
      lineupTemplateSchema.safeParse({
        version: 1,
        name: 'x',
        instruments: [{ name: 'Horn', voices: [{ name: 'Horn in F' }] }],
        substitutes: { 'Horn in F': ['Horn in G'] },
      }).success,
    ).toBe(false);
  });
});
