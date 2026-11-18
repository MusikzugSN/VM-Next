import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import type { MemberScoreRow } from '@vm-web/shared';
import axe from 'axe-core';

import global from '../../../../../public/translate/de-DE/global.json';
import me from '../../../../../public/translate/de-DE/me.scope.json';
import { setViewportWidth } from '../../../../test-setup';
import { SessionStore } from '../../../core/auth/session.store';
import { MemberScoreList } from './member-score-list';

const rows: MemberScoreRow[] = [
  {
    scoreId: 's1',
    number: '1',
    title: 'Florentiner Marsch',
    composer: 'Julius Fučík',
    availability: 'available',
    sheets: [{ sheetId: 'sh1', voice: { id: 'v1', name: 'Trompete 1 in B', instrumentId: 'i' }, pageCount: 2, kind: 'own', substituteFor: null }],
  },
  {
    scoreId: 's2',
    number: '2',
    title: 'Böhmischer Traum',
    composer: 'Norbert Gälle',
    availability: 'substitute-only',
    sheets: [
      {
        sheetId: 'sh2',
        voice: { id: 'v2', name: 'Flügelhorn 1 in B', instrumentId: 'i' },
        pageCount: 1,
        kind: 'substitute',
        substituteFor: { id: 'v1', name: 'Trompete 1 in B', instrumentId: 'i' },
      },
    ],
  },
  { scoreId: 's3', number: '3', title: 'Abba Gold', composer: null, availability: 'missing', sheets: [] },
];

async function render(width: number) {
  setViewportWidth(width);
  await TestBed.configureTestingModule({
    imports: [
      MemberScoreList,
      TranslocoTestingModule.forRoot({
        langs: { 'de-DE': global, 'me/de-DE': me },
        translocoConfig: { availableLangs: ['de-DE'], defaultLang: 'de-DE' },
        preloadLangs: true,
      }),
    ],
    providers: [provideRouter([]), { provide: SessionStore, useValue: { can: () => true } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(MemberScoreList);
  fixture.componentRef.setInput('rows', rows);
  fixture.componentRef.setInput('folderId', 'f1');
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MemberScoreList', () => {
  afterEach(() => setViewportWidth(1440));

  it('renders a table with numbers, substitute and missing states (desktop)', async () => {
    const el = await render(1440);
    const text = el.textContent ?? '';
    expect(el.querySelector('table')).not.toBeNull();
    expect(text).toContain('01');
    expect(text).toContain('Ersatz: Flügelhorn 1 in B');
    expect(text).toContain('Stimme fehlt');
    expect(el.querySelector('a[download]')?.getAttribute('href')).toBe('/internal/v1/me/sheets/sh1/pdf?folderId=f1');
    expect(el.querySelector('a[href^="/me/scores/s1"]')?.getAttribute('href')).toBe('/me/scores/s1?folderId=f1');
  });

  it('renders cards on phones', async () => {
    const el = await render(375);
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelectorAll('li')).toHaveLength(3);
    expect(el.textContent).toContain('2 Seiten');
    expect(el.textContent).toContain('1 Seite');
  });

  it('has no axe violations', async () => {
    const el = await render(1440);
    const result = await axe.run(el, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(', ')}`)).toEqual([]);
  });
});
