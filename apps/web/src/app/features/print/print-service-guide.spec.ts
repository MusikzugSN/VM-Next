import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import global from '../../../../public/translate/de-DE/global.json';
import type { PrintServiceIssue } from '../../core/print/print-service-client';
import { PrintServiceGuide } from './print-service-guide';

@Component({
  imports: [PrintServiceGuide],
  template: `<vm-print-service-guide [state]="state()" (recheck)="rechecked.set(rechecked() + 1)" />`,
})
class Host {
  readonly state = signal<PrintServiceIssue>({ kind: 'offline' });
  readonly rechecked = signal(0);
}

async function render(state: PrintServiceIssue) {
  await TestBed.configureTestingModule({
    imports: [
      Host,
      TranslocoTestingModule.forRoot({
        langs: { 'de-DE': global },
        translocoConfig: { availableLangs: ['de-DE'], defaultLang: 'de-DE' },
        preloadLangs: true,
      }),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.state.set(state);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
}

describe('PrintServiceGuide', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('explains an offline service and the own VM-Web address', async () => {
    const { el } = await render({ kind: 'offline' });
    const text = el.textContent ?? '';
    expect(text).toContain('Kein Druckservice auf diesem Computer');
    expect(text).toContain('So richtest du den Druckservice ein');
    expect(el.querySelector('code')?.textContent).toBe(location.origin);
  });

  it('explains a wrong origin', async () => {
    const { el } = await render({ kind: 'incompatible', reason: 'origin' });
    expect(el.textContent).toContain('nimmt aber keine Aufträge von dieser VM-Web-Adresse an');
  });

  it('explains an outdated service', async () => {
    const { el } = await render({ kind: 'incompatible', reason: 'contract' });
    expect(el.textContent).toContain('zu alt für diese VM-Web-Version');
  });

  it('emits recheck when the button is clicked', async () => {
    const { el, host } = await render({ kind: 'offline' });
    const button = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Erneut prüfen'));
    button?.dispatchEvent(new Event('click'));
    expect(host.rechecked()).toBe(1);
  });
});
