import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import global from '../../../../public/translate/de-DE/global.json';
import { APP_VERSION } from '../../core/app-version';
import { PRINT_SERVICE, PrintServiceFailure, type PrintServiceClient, type PrintServiceState } from '../../core/print/print-service-client';
import { PrintServiceUpdateDialog, RESTART_POLL_MS } from './print-service-update-dialog';

const ready = (version: string): PrintServiceState => ({ kind: 'ready', status: { version, contracts: [1], printers: [] } });

/** Local print service whose version changes once `update` went through. */
function fakeService(initial: PrintServiceState, options: { seen?: boolean; failWith?: string; restartsTo?: string } = {}) {
  let state = initial;
  const updates: string[] = [];
  const service: PrintServiceClient = {
    state: async () => state,
    jobs: async () => [],
    submit: async () => Promise.reject(new Error('unused')),
    cancel: async () => Promise.reject(new Error('unused')),
    retry: async () => Promise.reject(new Error('unused')),
    update: async (version) => {
      if (options.failWith) throw new PrintServiceFailure(options.failWith);
      updates.push(version);
      state = ready(options.restartsTo ?? version);
    },
    seenBefore: () => options.seen ?? true,
  };
  return { service, updates };
}

async function render(service: PrintServiceClient, appVersion = '1.2.0') {
  await TestBed.configureTestingModule({
    imports: [
      PrintServiceUpdateDialog,
      TranslocoTestingModule.forRoot({
        langs: { 'de-DE': global },
        translocoConfig: { availableLangs: ['de-DE'], defaultLang: 'de-DE' },
        preloadLangs: true,
      }),
    ],
    providers: [
      { provide: PRINT_SERVICE, useValue: service },
      { provide: APP_VERSION, useValue: appVersion },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PrintServiceUpdateDialog);
  await fixture.componentInstance.checked;
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

/** The dialog renders into an overlay outside the component. */
const text = () => document.body.textContent ?? '';
const button = (label: string) => [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

describe('PrintServiceUpdateDialog', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('stays silent when the versions match, the service is offline, unseen or a dev build', async () => {
    for (const [state, options, app] of [
      [ready('1.2.0'), {}, '1.2.0'],
      [{ kind: 'offline' }, {}, '1.2.0'],
      [ready('1.1.0'), { seen: false }, '1.2.0'],
      [ready('0.0.0-dev'), {}, '1.2.0'],
      [ready('1.1.0'), {}, '0.0.0'],
    ] as const) {
      await render(fakeService(state as PrintServiceState, options).service, app);
      expect(text()).not.toContain('Druckservice aktualisieren');
      expect(text()).not.toContain('neuer als VM-Web');
      TestBed.resetTestingModule();
    }
  });

  it('updates an older service and confirms the new version', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    const { service, updates } = fakeService(ready('1.1.0'));
    const fixture = await render(service);
    expect(text()).toContain('Version 1.1.0');
    expect(text()).toContain('Version 1.2.0');

    button('Jetzt aktualisieren')?.click();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(text()).toContain('startet neu');
    expect(updates).toEqual(['1.2.0']);

    await vi.advanceTimersByTimeAsync(RESTART_POLL_MS);
    fixture.detectChanges();
    expect(text()).toContain('Druckservice aktualisiert');
    expect(text()).toContain('läuft jetzt mit Version 1.2.0');
  });

  it('offers the update when only the contract shows the service is too old', async () => {
    await render(fakeService({ kind: 'incompatible', reason: 'contract' }).service);
    expect(text()).toContain('zu alt für VM-Web 1.2.0');
    expect(button('Jetzt aktualisieren')).toBeTruthy();
  });

  it('only informs about a newer service (no downgrade)', async () => {
    await render(fakeService(ready('1.3.0')).service);
    expect(text()).toContain('neuer als VM-Web');
    expect(button('Jetzt aktualisieren')).toBeUndefined();
  });

  it('explains the manual update for services without the update endpoint', async () => {
    const fixture = await render(fakeService(ready('1.1.0'), { failWith: 'update-unavailable' }).service);
    button('Jetzt aktualisieren')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text()).toContain('einmalig von Hand');
    expect(text()).toContain('./install.sh');
    const link = document.body.querySelector<HTMLAnchorElement>('a[href*="releases/tag/v1.2.0"]');
    expect(link).toBeTruthy();
  });

  it('offers a retry when the update failed', async () => {
    const fixture = await render(fakeService(ready('1.1.0'), { failWith: 'update-failed' }).service);
    button('Jetzt aktualisieren')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text()).toContain('bisherigen Version weiter');
    expect(button('Erneut versuchen')).toBeTruthy();
  });
});
