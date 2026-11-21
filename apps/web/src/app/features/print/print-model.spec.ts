import type { PrintJob, PrintPlanResponse } from '@vm-web/shared';

import { planScores, printQuery, sheetsLabel, statusChanges } from './print-model';

const options = { mode: 'all' as const, scoreIds: [], voiceIds: ['v1'], substitutes: 'fallback' as const };

describe('printQuery', () => {
  it('prints a whole folder', () => {
    expect(printQuery({ scope: 'folder', id: 'f1', title: 'Marschbuch' }, options)).toEqual({
      scope: 'folder',
      folderId: 'f1',
      voiceId: ['v1'],
      substitutes: 'fallback',
    });
  });

  it('prints a selection with the event as context', () => {
    expect(printQuery({ scope: 'event', id: 'e1', title: 'Konzert' }, { ...options, mode: 'selection', scoreIds: ['s1', 's2'] })).toMatchObject({
      scope: 'selection',
      eventId: 'e1',
      scoreIds: ['s1', 's2'],
    });
  });

  it('prints a selection from a list with its folder as context', () => {
    expect(printQuery({ scope: 'selection', id: '', title: 'Auswahl', scoreIds: ['s2', 's1'], folderId: 'f1' }, options)).toMatchObject({
      scope: 'selection',
      scoreIds: ['s2', 's1'],
      folderId: 'f1',
    });
  });

  it('ignores the selection mode for a single score', () => {
    expect(printQuery({ scope: 'score', id: 's1', title: 'Marsch' }, { ...options, mode: 'selection' })).toMatchObject({ scope: 'score', scoreId: 's1' });
  });
});

describe('sheetsLabel', () => {
  it.each([
    [1, 'simplex', 'print.sheets.single'],
    [3, 'simplex', 'print.sheets.simplex'],
    [1, 'duplex', 'print.sheets.duplexOne'],
    [2, 'duplex', 'print.sheets.duplex'],
  ] as const)('%i sheets %s → %s', (sheets, mode, key) => {
    expect(sheetsLabel(sheets, mode)).toEqual({ key, params: { sheets } });
  });
});

describe('planScores', () => {
  it('lists each score once in print order', () => {
    const doc = (scoreId: string, voice: string) => ({
      scoreId,
      number: null,
      title: scoreId,
      voice: { id: voice, name: voice, instrumentId: 'i' },
      kind: 'own' as const,
      pages: 1,
      mode: 'simplex' as const,
      sheets: 1,
      blankPagesAfter: 0,
    });
    const plan: PrintPlanResponse = {
      totalPages: 3,
      pageLimit: 10,
      route: 'browser',
      duplex: false,
      rules: { source: null, items: [{ fromPages: 1, mode: 'simplex' }] },
      documents: [doc('a', 'v1'), doc('a', 'v2'), doc('b', 'v1')],
      missing: [],
    };
    expect(planScores(plan).map((s) => s.scoreId)).toEqual(['a', 'b']);
  });
});

describe('statusChanges', () => {
  const job = (id: string, status: PrintJob['status']): PrintJob => ({
    id,
    status,
    source: { kind: 'folder', title: 'Marschbuch', voices: [] },
    printer: { id: 'p', name: 'Drucker' },
    pages: 4,
    printedPages: null,
    error: null,
    createdAt: '2026-11-18T10:00:00Z',
    updatedAt: '2026-11-18T10:00:00Z',
  });

  it('reports changed jobs only, not new ones', () => {
    const changes = statusChanges([job('1', 'waiting'), job('2', 'printing')], [job('1', 'printing'), job('2', 'printing'), job('3', 'waiting')]);
    expect(changes.map((c) => [c.job.id, c.status])).toEqual([['1', 'printing']]);
  });
});
