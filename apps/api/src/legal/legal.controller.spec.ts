import {
  EMPTY_IMPRINT_DATA,
  EMPTY_PRIVACY_DATA,
  type LegalSettingsResponse,
  type PublicLegalDocumentResponse,
  type UpdateLegalSettingsBody,
} from '@vm-web/shared';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import type { PersonKey } from '../testing/access-fixtures';
import { FULL_IMPRINT, FULL_PRIVACY, TestLegalTemplateSource } from '../testing/legal-fixtures';
import { createTestApp, type TestApp } from '../testing/test-app';
import { LEGAL_TEMPLATES } from './legal-template-source';
import { PublicLegalController, SystemLegalController } from './legal.controller';
import { LegalService } from './legal.service';
import { InMemoryLegalStore, LEGAL_STORE } from './legal.store';

const GENERATED = { mode: 'generated', url: null } as const;

const fullBody = (patch: Partial<UpdateLegalSettingsBody> = {}): UpdateLegalSettingsBody => ({
  imprint: GENERATED,
  privacy: GENERATED,
  imprintData: FULL_IMPRINT,
  privacyData: FULL_PRIVACY,
  ...patch,
});

describe('Legal endpoints (S-7)', () => {
  let t: TestApp;
  let store: InMemoryLegalStore;
  let templates: TestLegalTemplateSource;
  const club = { publicBaseUrl: null as string | null };

  beforeEach(async () => {
    store = new InMemoryLegalStore();
    templates = new TestLegalTemplateSource();
    club.publicBaseUrl = null;
    t = await createTestApp(
      { controllers: [PublicLegalController, SystemLegalController], providers: [LegalService] },
      {
        providers: [
          { provide: LEGAL_STORE, useValue: store },
          { provide: LEGAL_TEMPLATES, useValue: templates },
          { provide: ClubSettingsRepository, useValue: { get: async () => club } },
        ],
        config: { APP_TIMEZONE: 'Europe/Berlin' },
      },
    );
  });
  afterEach(() => t.close());

  const publicGet = (doc: 'imprint' | 'privacy', headers: Record<string, string> = {}) =>
    fetch(`${t.baseUrl}/public/legal/${doc}`, { headers });
  const publicJson = async (doc: 'imprint' | 'privacy') => (await (await publicGet(doc)).json()) as PublicLegalDocumentResponse;

  async function call(person: PersonKey | null, method: 'GET' | 'POST', path: string, body?: unknown) {
    const headers: Record<string, string> = person ? await t.loginAs(person) : {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    return fetch(`${t.baseUrl}/system/legal/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  const save = async (body: UpdateLegalSettingsBody) => expect((await call('adminFlag', 'POST', 'update-settings', body)).status).toBe(204);
  const settings = async () => (await (await call('adminFlag', 'GET', 'settings')).json()) as LegalSettingsResponse;

  describe('public pages', () => {
    it('are reachable without session and say „unavailable“ while not configured', async () => {
      const res = await publicGet('imprint');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ mode: 'unavailable' });
      expect(res.headers.get('cache-control')).toBe('public, no-cache');
      expect(await publicJson('privacy')).toEqual({ mode: 'unavailable' });
    });

    it('return the URL in link mode', async () => {
      await save(fullBody({ imprint: { mode: 'link', url: 'https://mv.example/impressum' } }));
      expect(await publicJson('imprint')).toEqual({ mode: 'link', url: 'https://mv.example/impressum' });
    });

    it('return the rendered HTML with „Stand“ and template version when complete', async () => {
      await save(fullBody());
      const imprint = await publicJson('imprint');
      expect(imprint).toMatchObject({ mode: 'generated', templateVersion: 1 });
      if (imprint.mode !== 'generated') throw new Error('expected generated');
      expect(imprint.html).toContain('<h1>Impressum</h1>');
      expect(imprint.html).toContain('Musikverein Harmonie Talheim e.V.');
      expect(imprint.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(imprint.html).toContain('Vorlage Version 1');
    });

    it('do not publish an incomplete generated document', async () => {
      await save(fullBody({ imprintData: { ...FULL_IMPRINT, phone: null, representatives: [FULL_IMPRINT.representatives[1]] } }));
      expect(await publicJson('imprint')).toEqual({ mode: 'unavailable' });
      // the privacy policy takes the controller from the imprint data
      expect(await publicJson('privacy')).toEqual({ mode: 'unavailable' });
    });

    it('do not publish a privacy policy while the authority is unverified', async () => {
      await save(fullBody({ privacyData: { ...FULL_PRIVACY, state: 'BY' } }));
      expect(await publicJson('privacy')).toEqual({ mode: 'unavailable' });
      expect((await publicJson('imprint')).mode).toBe('generated');
    });

    it('support conditional requests (ETag / 304)', async () => {
      await save(fullBody());
      const first = await publicGet('imprint');
      const etag = first.headers.get('etag');
      expect(etag).toBeTruthy();
      // fetch() adds `cache-control: no-cache` to conditional requests unless one is given; browsers revalidate with max-age=0
      const second = await publicGet('imprint', { 'if-none-match': etag as string, 'cache-control': 'max-age=0' });
      expect(second.status).toBe(304);
    });

    it('show the print service section only when it is configured', async () => {
      await save(fullBody());
      const html = async () => {
        const r = await publicJson('privacy');
        return r.mode === 'generated' ? r.html : '';
      };
      expect(await html()).not.toContain('Druckservice');
      club.publicBaseUrl = 'https://noten.mv.example';
      expect(await html()).toContain('Lokaler Druckservice');
    });
  });

  describe('settings endpoints', () => {
    it('need a session', async () => {
      expect((await call(null, 'GET', 'settings')).status).toBe(401);
      expect((await call(null, 'GET', 'status')).status).toBe(401);
    });

    it('need the configuration permission', async () => {
      for (const path of ['settings', 'status']) expect((await call('plainMember', 'GET', path)).status).toBe(403);
      for (const [path, body] of [
        ['update-settings', fullBody()],
        ['preview', { document: 'imprint', imprintData: FULL_IMPRINT, privacyData: FULL_PRIVACY }],
        ['accept-template-version', { document: 'imprint', version: 1 }],
      ] as const) {
        expect((await call('orchestraLibrarian', 'POST', path, body)).status).toBe(403);
      }
      expect((await call('youthAdminRole', 'GET', 'settings')).status).toBe(200);
    });

    it('start empty and not configured', async () => {
      const s = await settings();
      expect(s.imprint).toMatchObject({ mode: null, status: 'not-configured', missingFields: ['mode'] });
      expect(s.imprint.template).toEqual({ acceptedVersion: null, acceptedAt: null, availableVersion: 1, availableDate: '2026-11-24', updateAvailable: false });
      expect(s.imprintData).toEqual(EMPTY_IMPRINT_DATA);
      expect(s.privacyData).toEqual(EMPTY_PRIVACY_DATA);
      expect(s.activeModules).toEqual(['base', 'library']);
      expect(s.warnings).toEqual([]);
      expect(await (await call('adminFlag', 'GET', 'status')).json()).toEqual({ imprint: 'not-configured', privacy: 'not-configured', templateUpdateAvailable: false });
    });

    it('save incomplete data and list the missing fields', async () => {
      await save(fullBody({ imprintData: { ...EMPTY_IMPRINT_DATA, legalName: 'MV e.V.' }, privacyData: EMPTY_PRIVACY_DATA }));
      const s = await settings();
      expect(s.imprint.status).toBe('incomplete');
      expect(s.imprint.missingFields).toContain('imprint.contact.email');
      expect(s.imprint.missingFields).not.toContain('imprint.legalName');
      expect(s.privacy.missingFields).toContain('privacy.state');
      expect(s.imprintData.legalName).toBe('MV e.V.');
      // first switch to generated accepts the shipped template
      expect(s.imprint.template.acceptedVersion).toBe(1);
    });

    it('warns about a hoster without data processing agreement but still publishes', async () => {
      await save(fullBody({ privacyData: { ...FULL_PRIVACY, hosting: { ...FULL_PRIVACY.hosting, dpaConcluded: false } } }));
      expect((await settings()).warnings).toEqual(['hosting-without-dpa']);
      expect((await publicJson('privacy')).mode).toBe('generated');
    });

    it('rejects a server location outside the EU/EEA with the code not_eea', async () => {
      const res = await call('adminFlag', 'POST', 'update-settings', fullBody({ privacyData: { ...FULL_PRIVACY, identityServer: { ...FULL_PRIVACY.identityServer, serverCountry: 'US' } } }));
      expect(res.status).toBe(400);
      expect((await res.json()).errors).toEqual([{ path: '/body/privacyData/identityServer/serverCountry', code: 'not_eea' }]);
    });

    it('rejects a PO box with the code po_box', async () => {
      const res = await call('adminFlag', 'POST', 'update-settings', fullBody({ imprintData: { ...FULL_IMPRINT, address: { ...FULL_IMPRINT.address, street: 'Postfach 12 34' } } }));
      expect(res.status).toBe(400);
      expect((await res.json()).errors).toEqual([{ path: '/body/imprintData/address/street', code: 'po_box' }]);
    });

    it('previews unsaved data and marks missing values', async () => {
      const res = await call('adminFlag', 'POST', 'preview', { document: 'imprint', imprintData: { ...FULL_IMPRINT, registerNumber: null }, privacyData: EMPTY_PRIVACY_DATA });
      expect(res.status).toBe(200);
      const preview = await res.json();
      expect(preview.missingFields).toEqual(['imprint.registerNumber']);
      expect(preview.html).toContain('[fehlt: imprint.registerNumber]');
      expect(preview.templateVersion).toBe(1);
      // nothing was saved
      expect((await settings()).imprintData).toEqual(EMPTY_IMPRINT_DATA);
    });
  });

  describe('template versions', () => {
    it('a new version changes the published text only after „Übernehmen“', async () => {
      await save(fullBody());
      const before = await publicJson('imprint');

      templates.bump('imprint', 'NEUER ABSATZ');
      expect(await publicJson('imprint')).toEqual(before);
      const s = await settings();
      expect(s.imprint.template).toMatchObject({ acceptedVersion: 1, availableVersion: 2, updateAvailable: true });
      expect((await (await call('adminFlag', 'GET', 'status')).json()).templateUpdateAvailable).toBe(true);

      // saving data again keeps the accepted version
      await save(fullBody({ imprintData: { ...FULL_IMPRINT, phone: '+49 7133 999999' } }));
      const afterSave = await publicJson('imprint');
      expect(afterSave.mode === 'generated' && afterSave.html).not.toContain('NEUER ABSATZ');

      // the preview of the available version shows the new text
      const preview = await (await call('adminFlag', 'POST', 'preview', { document: 'imprint', templateVersion: 'available', imprintData: FULL_IMPRINT, privacyData: FULL_PRIVACY })).json();
      expect(preview).toMatchObject({ templateVersion: 2, templateDate: '2027-03-01' });
      expect(preview.html).toContain('NEUER ABSATZ');

      expect((await call('adminFlag', 'POST', 'accept-template-version', { document: 'imprint', version: 2 })).status).toBe(204);
      const after = await publicJson('imprint');
      expect(after).toMatchObject({ mode: 'generated', templateVersion: 2 });
      expect(after.mode === 'generated' && after.html).toContain('NEUER ABSATZ');
      expect((await settings()).imprint.template).toMatchObject({ acceptedVersion: 2, updateAvailable: false });
      expect(store.state.documents.imprint.acceptedAt).toBeInstanceOf(Date);
    });

    it('does not publish when a stored template no longer fits the data model', async () => {
      await save(fullBody());
      const t = store.state.documents.imprint.acceptedTemplate;
      if (!t) throw new Error('template not accepted');
      store.state.documents.imprint.acceptedTemplate = { ...t, main: `${t.main}\n{{imprint.removedField}}\n` };
      expect(await publicJson('imprint')).toEqual({ mode: 'unavailable' });
    });

    it('refuses to accept a version that is not the available one', async () => {
      await save(fullBody());
      expect((await call('adminFlag', 'POST', 'accept-template-version', { document: 'imprint', version: 2 })).status).toBe(409);
      expect((await call('adminFlag', 'POST', 'accept-template-version', { document: 'imprint', version: 1 })).status).toBe(409);
    });
  });
});
