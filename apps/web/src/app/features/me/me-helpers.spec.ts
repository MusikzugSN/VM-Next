import type { MemberScoreRow, MemberSheet } from '@vm-web/shared';

import { pluralKey } from '../../core/i18n/plural.pipe';
import { sheetPdfUrl, withQuery } from '../../core/api/urls';
import { clampPage } from '../../shared/ui/pdf-viewer';
import { displayNumber, pageTotal, shownSheets } from './ui/member-score-list';
import { decodeTagFilter, encodeTagFilter } from './ui/tag-filter';
import { filterVoiceGroups } from './ui/voice-selection-dialog';

const voice = (id: string) => ({ id, name: id, instrumentId: 'i' });
const sheet = (id: string, kind: MemberSheet['kind'], pageCount = 2): MemberSheet => ({
  sheetId: id,
  voice: voice(`v-${id}`),
  pageCount,
  kind,
  substituteFor: kind === 'substitute' ? voice('v-own') : null,
});
const row = (sheets: MemberSheet[]): MemberScoreRow => ({
  scoreId: 's1',
  number: '1',
  title: 'Florentiner Marsch',
  composer: 'Julius Fučík',
  availability: sheets.some((s) => s.kind === 'own') ? 'available' : sheets.length ? 'substitute-only' : 'missing',
  sheets,
});

describe('score rows (M-3)', () => {
  it('shows own sheets, otherwise the first substitute', () => {
    expect(shownSheets(row([sheet('a', 'own'), sheet('b', 'own'), sheet('c', 'substitute')])).map((s) => s.sheetId)).toEqual(['a', 'b']);
    expect(shownSheets(row([sheet('c', 'substitute'), sheet('d', 'substitute')])).map((s) => s.sheetId)).toEqual(['c']);
    expect(shownSheets(row([]))).toEqual([]);
  });

  it('adds up the pages of the shown sheets', () => {
    expect(pageTotal(row([sheet('a', 'own', 2), sheet('b', 'own', 3), sheet('c', 'substitute', 9)]))).toBe(5);
  });

  it('shows folder numbers with two digits (Design Guideline)', () => {
    expect(displayNumber('1')).toBe('01');
    expect(displayNumber('12')).toBe('12');
    expect(displayNumber('12a')).toBe('12a');
    expect(displayNumber(null)).toBe('');
  });
});

describe('voice selection (M-1)', () => {
  const groups = [
    { instrument: { id: 'tp', name: 'Trompete' }, voices: [{ id: 'tp1', name: 'Trompete 1 in B' }, { id: 'flh', name: 'Flügelhorn 1 in B' }] },
    { instrument: { id: 'kl', name: 'Klarinette' }, voices: [{ id: 'kl1', name: 'Klarinette 1 in B' }] },
  ];

  it('keeps whole groups when the instrument matches and filters voices otherwise', () => {
    expect(filterVoiceGroups(groups, 'klar').map((g) => g.instrument.id)).toEqual(['kl']);
    expect(filterVoiceGroups(groups, 'FLÜGEL')).toEqual([{ ...groups[0], voices: [groups[0].voices[1]] }]);
    expect(filterVoiceGroups(groups, '  ')).toEqual(groups);
    expect(filterVoiceGroups(groups, 'tuba')).toEqual([]);
  });
});

describe('tag filter (M-8)', () => {
  it('encodes and decodes the radio value', () => {
    expect(encodeTagFilter({ kind: 'personal', id: 't1' })).toBe('personal:t1');
    expect(decodeTagFilter('club:t2')).toEqual({ kind: 'club', id: 't2' });
    expect(decodeTagFilter('')).toBeNull();
    expect(decodeTagFilter('other:x')).toBeNull();
  });
});

describe('download URLs (M-6)', () => {
  it('builds sheet URLs with folder context and inline disposition', () => {
    expect(sheetPdfUrl('sh1')).toBe('/internal/v1/me/sheets/sh1/pdf');
    expect(sheetPdfUrl('sh1', { folderId: 'f1', inline: true })).toBe('/internal/v1/me/sheets/sh1/pdf?folderId=f1&disposition=inline');
  });

  it('repeats voice ids and drops empty values', () => {
    expect(withQuery('/x', { voiceId: ['a', 'b'], q: '' })).toBe('/x?voiceId=a&voiceId=b');
    expect(withQuery('/x', {})).toBe('/x');
  });
});

describe('helpers', () => {
  it('picks the German plural form', () => {
    expect(pluralKey('me.list.pages', 1)).toBe('me.list.pages.one');
    expect(pluralKey('me.list.pages', 0)).toBe('me.list.pages.other');
    expect(pluralKey('me.list.pages', 2)).toBe('me.list.pages.other');
  });

  it('keeps the PDF page inside the document', () => {
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(5, 3)).toBe(3);
    expect(clampPage(2, 0)).toBe(1);
  });
});
