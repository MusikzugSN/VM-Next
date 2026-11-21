import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import type { PrintJob, PrintJobStatus } from '@vm-web/shared';
import axe from 'axe-core';

import global from '../../../../public/translate/de-DE/global.json';
import { setViewportWidth } from '../../../test-setup';
import { PRINT_SERVICE, type PrintServiceClient, type PrintServiceState } from '../../core/print/print-service-client';
import { PrintHistoryPage } from './print-history-page';

function job(id: string, status: PrintJobStatus, extra: Partial<PrintJob> = {}): PrintJob {
  return {
    id,
    status,
    source: { kind: 'folder', title: `Mappe ${id}`, voices: ['Trompete 1 in B'] },
    printer: { id: 'hp', name: 'HP LaserJet' },
    pages: 34,
    printedPages: null,
    error: null,
    createdAt: '2026-11-18T17:42:00Z',
    updatedAt: '2026-11-18T17:42:00Z',
    ...extra,
  };
}

/** Fake of the local print service (docs/print-service.md). */
function fakeService(state: PrintServiceState, jobs: PrintJob[] = []): PrintServiceClient & { cancelled: string[] } {
  const cancelled: string[] = [];
  return {
    cancelled,
    state: async () => state,
    jobs: async () => jobs,
    submit: async () => jobs[0],
    cancel: async (id) => {
      cancelled.push(id);
      return jobs[0];
    },
    retry: async () => jobs[0],
  };
}

async function render(service: PrintServiceClient) {
  setViewportWidth(1440);
  await TestBed.configureTestingModule({
    imports: [
      PrintHistoryPage,
      TranslocoTestingModule.forRoot({
        langs: { 'de-DE': global },
        translocoConfig: { availableLangs: ['de-DE'], defaultLang: 'de-DE' },
        preloadLangs: true,
      }),
    ],
    providers: [{ provide: PRINT_SERVICE, useValue: service }],
  }).compileComponents();
  const fixture = TestBed.createComponent(PrintHistoryPage);
  // Two rounds: service check, then the jobs.
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('PrintHistoryPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows every job state of the print service (D-5)', async () => {
    const { el, fixture } = await render(
      fakeService({ kind: 'ready', status: { version: '1.0.0', contracts: [1], printers: [{ id: 'hp', name: 'HP LaserJet', isDefault: true }] } }, [
        job('1', 'printing', { printedPages: 12 }),
        job('2', 'waiting'),
        job('3', 'done'),
        job('4', 'failed', { error: 'Drucker nicht erreichbar' }),
      ]),
    );
    const text = el.textContent ?? '';
    expect(text).toContain('Druckservice auf diesem Computer verbunden');
    expect(text).toContain('Druckt 12/34');
    expect(text).toContain('Wartend');
    expect(text).toContain('Fertig');
    expect(text).toContain('Fehler');
    expect(text).toContain('Drucker nicht erreichbar');
    // Running jobs can be cancelled, finished or failed ones sent again.
    const buttons = [...el.querySelectorAll('tbody button')].map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Abbrechen', 'Abbrechen', 'Erneut senden', 'Erneut senden']);

    const results = await axe.run(el, { rules: { region: { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);
    fixture.destroy();
  });

  it('explains the setup when no print service runs (D-3)', async () => {
    const { el, fixture } = await render(fakeService({ kind: 'offline' }));
    expect(el.textContent).toContain('Kein Druckservice auf diesem Computer');
    expect(el.querySelector('code')?.textContent).toBe(location.origin);
    expect(el.querySelector('table')).toBeNull();
    fixture.destroy();
  });
});
