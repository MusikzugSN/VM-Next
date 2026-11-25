import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { EMPTY_IMPRINT_DATA, EMPTY_PRIVACY_DATA, legalMissingFieldSchema } from '@vm-web/shared';

import { cleanForm, emptyPerson, fieldLabelKey, GERMAN_STATES, imprintDataPlace, linkMissing, previewForm, setPath, validateForm, type LegalForm } from './legal-model';

const form = (patch: Partial<LegalForm> = {}): LegalForm => ({
  imprint: { mode: 'generated', url: null },
  privacy: { mode: null, url: null },
  imprintData: structuredClone(EMPTY_IMPRINT_DATA),
  privacyData: structuredClone(EMPTY_PRIVACY_DATA),
  ...patch,
});

describe('legal settings model (S-7)', () => {
  it('trims strings, turns empty ones into null and drops empty representative rows', () => {
    const f = form();
    f.imprintData.legalName = '  MV e.V. ';
    f.imprintData.email = '   ';
    f.imprintData.representatives = [{ ...emptyPerson(), name: 'Sandra', role: 'Vorsitzende', email: ' s@x.example ' }, emptyPerson()];
    const clean = cleanForm(f);
    expect(clean.imprintData.legalName).toBe('MV e.V.');
    expect(clean.imprintData.email).toBeNull();
    // an address without any value becomes null, the empty row is dropped
    expect(clean.imprintData.representatives).toEqual([{ name: 'Sandra', role: 'Vorsitzende', address: null, email: 's@x.example', phone: null }]);
  });

  it('drops provider details when the club runs the service itself', () => {
    const f = form();
    f.privacyData.hosting = { operator: 'self', provider: { name: 'Alt', address: 'X' }, serverCountry: 'DE', dpaConcluded: true };
    f.privacyData.identityServer = { operator: 'self', provider: { name: 'Alt', address: 'Y' }, serverCountry: 'DE' };
    const clean = cleanForm(f);
    expect(clean.privacyData.hosting).toEqual({ operator: 'self', provider: null, serverCountry: 'DE', dpaConcluded: null });
    expect(clean.privacyData.identityServer.provider).toBeNull();
  });

  it('accepts an incomplete form', () => {
    expect('body' in validateForm(form())).toBe(true);
  });

  it('reports a PO box and invalid values at their paths', () => {
    const f = form();
    f.imprintData.address.street = 'Postfach 12 34';
    f.imprintData.address.postalCode = '123';
    f.imprintData.email = 'keine-mail';
    const result = validateForm(f);
    expect('errors' in result && result.errors).toEqual({
      'imprintData/address/street': 'po_box',
      'imprintData/address/postalCode': 'invalid_format',
      'imprintData/email': 'invalid_format',
    });
  });

  it('leaves out values that are still invalid, so the preview keeps working', () => {
    const f = form();
    f.imprintData.legalName = 'MV e.V.';
    f.imprintData.address.street = 'Postfach 12 34';
    f.imprintData.email = 'vorst';
    f.imprintData.representatives = [
      { ...emptyPerson(), name: 'Sandra', role: '' },
      { ...emptyPerson(), name: 'Jonas', role: 'Kassier', email: 'jonas@', phone: '+49 7133 1234' },
    ];
    f.imprintData.department = { name: 'Musikzug', email: '', phone: '', contacts: [{ ...emptyPerson(), name: 'Lea', role: 'Leitung', address: { street: 'PF 12', postalCode: '74388', city: 'Ort' } }] };
    f.privacyData.hosting.serverCountry = 'D';
    const p = previewForm(f);
    expect('body' in validateForm(p)).toBe(true);
    expect(p.imprintData).toMatchObject({ legalName: 'MV e.V.', email: null, address: { street: null } });
    expect(p.imprintData.representatives).toEqual([{ name: 'Jonas', role: 'Kassier', address: null, email: null, phone: '+49 7133 1234' }]);
    expect(p.imprintData.department?.contacts[0].address).toEqual({ street: null, postalCode: '74388', city: 'Ort' });
    expect(p.privacyData.hosting.serverCountry).toBeNull();
  });

  it('lists missing mode and URL for link mode', () => {
    expect(linkMissing({ mode: null, url: null })).toEqual(['mode']);
    expect(linkMissing({ mode: 'link', url: ' ' })).toEqual(['url']);
    expect(linkMissing({ mode: 'link', url: 'https://x.example' })).toEqual([]);
  });

  it('edits the club data in the imprint, or in the privacy section if only that one is generated', () => {
    expect(imprintDataPlace({ imprint: { mode: 'generated', url: null }, privacy: { mode: 'generated', url: null } })).toBe('imprint');
    expect(imprintDataPlace({ imprint: { mode: 'link', url: null }, privacy: { mode: 'generated', url: null } })).toBe('privacy');
    expect(imprintDataPlace({ imprint: { mode: 'link', url: null }, privacy: { mode: null, url: null } })).toBeNull();
  });

  it('updates nested values immutably, also in lists', () => {
    const data = { a: { b: 1 }, list: [{ name: 'x' }, { name: 'y' }] };
    const next = setPath(data, 'list.1.name', 'z');
    expect(next).toEqual({ a: { b: 1 }, list: [{ name: 'x' }, { name: 'z' }] });
    expect(data.list[1].name).toBe('y');
    expect(next.a).toBe(data.a);
    expect(Array.isArray(next.list)).toBe(true);
  });

  it('has a label for every missing-field code and every state', () => {
    let dir = process.cwd();
    while (!existsSync(join(dir, 'nx.json'))) dir = dirname(dir);
    const system = JSON.parse(readFileSync(join(dir, 'apps/web/public/translate/de-DE/system.scope.json'), 'utf8'));
    const lookup = (key: string) => key.split('.').slice(1).reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], system);
    for (const code of legalMissingFieldSchema.options) expect(typeof lookup(fieldLabelKey(code)), code).toBe('string');
    for (const state of GERMAN_STATES) expect(typeof lookup(`system.settings.legal.states.${state}`), state).toBe('string');
  });
});
