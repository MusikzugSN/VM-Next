import { EMPTY_IMPRINT_DATA, EMPTY_PRIVACY_DATA, updateLegalSettingsBodySchema, type ImprintData, type PrivacyData } from '@vm-web/shared';
import { DEPARTMENT_IMPRINT, FULL_IMPRINT, FULL_PRIVACY, TEST_AUTHORITIES } from '../testing/legal-fixtures';
import { documentMissing, imprintMissing, privacyMissing, privacyWarnings } from './legal-completeness';

const imprint = (patch: Partial<ImprintData>): ImprintData => ({ ...FULL_IMPRINT, ...patch });
/** Fixtures always have these; keeps the tests free of non-null assertions. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('fixture value missing');
  return value;
}
const privacy = (patch: Partial<PrivacyData>): PrivacyData => ({ ...FULL_PRIVACY, ...patch });

describe('legal completeness (S-7)', () => {
  describe('per mode', () => {
    const never = () => {
      throw new Error('generated data must not be checked');
    };

    it('requires a mode', () => {
      expect(documentMissing({ mode: null, url: 'https://x.example' }, never)).toEqual(['mode']);
    });

    it('link needs only the URL', () => {
      expect(documentMissing({ mode: 'link', url: null }, never)).toEqual(['url']);
      expect(documentMissing({ mode: 'link', url: 'https://x.example/impressum' }, never)).toEqual([]);
    });

    it('generated checks the data', () => {
      expect(documentMissing({ mode: 'generated', url: null }, () => ['imprint.contact.email'])).toEqual(['imprint.contact.email']);
    });
  });

  describe('imprint', () => {
    it('is complete with full data', () => {
      expect(imprintMissing(FULL_IMPRINT)).toEqual([]);
    });

    it('lists every required field of an empty form', () => {
      expect(imprintMissing(EMPTY_IMPRINT_DATA)).toEqual([
        'imprint.legalName',
        'imprint.representatives',
        'imprint.contact.address',
        'imprint.contact.email',
        'imprint.contact.phone',
        'imprint.registerCourt',
        'imprint.registerNumber',
      ]);
    });

    it('requires register court and number only for a registered association', () => {
      const unregistered = imprint({ isRegistered: false, registerCourt: null, registerNumber: null });
      expect(imprintMissing(unregistered)).toEqual([]);
      expect(imprintMissing(imprint({ registerNumber: '  ' }))).toEqual(['imprint.registerNumber']);
    });

    describe('contact (§ 5 DDG), checked per kind', () => {
      const sandra = FULL_IMPRINT.representatives[0];
      const jonas = FULL_IMPRINT.representatives[1];
      const noAddress = { street: null, postalCode: null, city: null };

      it('club address, e-mail and phone: no person needs contact data', () => {
        expect(imprintMissing(imprint({ representatives: [jonas] }))).toEqual([]);
      });

      it('without club address, a person must have a complete address', () => {
        expect(imprintMissing(imprint({ address: noAddress, representatives: [jonas] }))).toEqual(['imprint.contact.address']);
        expect(imprintMissing(imprint({ address: noAddress, representatives: [jonas, sandra] }))).toEqual([]);
        const noCity = { ...sandra, address: { ...defined(sandra.address), city: null } };
        expect(imprintMissing(imprint({ address: noAddress, representatives: [noCity] }))).toEqual(['imprint.contact.address']);
      });

      it('without club e-mail or phone, some person must have it', () => {
        expect(imprintMissing(imprint({ email: null, representatives: [jonas] }))).toEqual(['imprint.contact.email']);
        expect(imprintMissing(imprint({ phone: null, representatives: [jonas] }))).toEqual(['imprint.contact.phone']);
        expect(imprintMissing(imprint({ email: null, phone: null, representatives: [jonas, sandra] }))).toEqual([]);
      });

      it('the kinds may come from different persons', () => {
        const onlyMail = { ...jonas, email: 'jonas@x.example' };
        const onlyPhone = { ...sandra, address: null, email: null };
        const onlyAddress = { ...jonas, name: 'Lea', address: defined(sandra.address) };
        const club = imprint({ address: noAddress, email: null, phone: null, representatives: [onlyMail, onlyPhone, onlyAddress] });
        expect(imprintMissing(club)).toEqual([]);
      });

      it('lists each missing kind separately', () => {
        expect(imprintMissing(imprint({ address: noAddress, email: null, phone: null, representatives: [jonas] }))).toEqual([
          'imprint.contact.address',
          'imprint.contact.email',
          'imprint.contact.phone',
        ]);
      });

      it('a partly filled club address must be complete', () => {
        expect(imprintMissing(imprint({ address: { street: 'Weg 1', postalCode: null, city: null }, representatives: [jonas, sandra] }))).toEqual([
          'imprint.address.postalCode',
          'imprint.address.city',
        ]);
      });
    });

    describe('department of a parent club', () => {
      it('is complete with a contact person of the department, the parent board needs no contact', () => {
        expect(imprintMissing(DEPARTMENT_IMPRINT)).toEqual([]);
      });

      it('takes e-mail and phone from the department or its contact persons, not from the parent club', () => {
        const d = defined(DEPARTMENT_IMPRINT.department);
        const noContact = { ...DEPARTMENT_IMPRINT, email: 'x@y.example', phone: '+49 1 234567', department: { ...d, contacts: [] } };
        expect(imprintMissing(noContact)).toEqual(['imprint.department.contact.email', 'imprint.department.contact.phone']);
        const viaDepartment = { ...noContact, department: { ...d, contacts: [], email: 'musikzug@x.example', phone: '+49 7133 1111' } };
        expect(imprintMissing(viaDepartment)).toEqual([]);
      });

      it('takes the address from the parent club or a contact person', () => {
        const d = defined(DEPARTMENT_IMPRINT.department);
        const noParentAddress = { ...DEPARTMENT_IMPRINT, address: { street: null, postalCode: null, city: null } };
        expect(imprintMissing(noParentAddress)).toEqual([]);
        const contactWithoutAddress = { ...noParentAddress, department: { ...d, contacts: d.contacts.map((c) => ({ ...c, address: null })) } };
        expect(imprintMissing(contactWithoutAddress)).toEqual(['imprint.department.contact.address']);
      });

      it('needs the department name', () => {
        const d = defined(DEPARTMENT_IMPRINT.department);
        expect(imprintMissing({ ...DEPARTMENT_IMPRINT, department: { ...d, name: ' ' } })).toEqual(['imprint.department.name']);
      });

      it('still needs the board of the parent club', () => {
        expect(imprintMissing({ ...DEPARTMENT_IMPRINT, representatives: [] })).toEqual(['imprint.representatives']);
      });
    });

    it('optional fields are not required, but complete if given', () => {
      expect(imprintMissing(imprint({ vatId: null, contentResponsible: null }))).toEqual([]);
      expect(
        imprintMissing(imprint({ contentResponsible: { name: null, address: { street: 'Weg 1', postalCode: null, city: 'Ort' } } })),
      ).toEqual(['imprint.contentResponsible.name', 'imprint.contentResponsible.address']);
    });
  });

  describe('privacy policy', () => {
    it('is complete with full data and a verified authority', () => {
      expect(privacyMissing(FULL_IMPRINT, FULL_PRIVACY, TEST_AUTHORITIES)).toEqual([]);
    });

    it('takes the controller from the imprint data, without the register', () => {
      const missing = privacyMissing(imprint({ email: null, registerCourt: null, representatives: [FULL_IMPRINT.representatives[1]] }), FULL_PRIVACY, TEST_AUTHORITIES);
      expect(missing).toEqual(['imprint.contact.email']);
    });

    it('lists the privacy fields of an empty form', () => {
      expect(privacyMissing(FULL_IMPRINT, EMPTY_PRIVACY_DATA, TEST_AUTHORITIES)).toEqual([
        'privacy.hosting.operator',
        'privacy.hosting.serverCountry',
        'privacy.identityServer.operator',
        'privacy.identityServer.serverCountry',
        'privacy.serverLogRetentionDays',
        'privacy.backupRetentionDays',
        'privacy.state',
      ]);
    });

    it('needs provider details only for an external provider', () => {
      const self = privacy({
        hosting: { operator: 'self', provider: null, serverCountry: 'DE', dpaConcluded: null },
        identityServer: { operator: 'self', provider: null, serverCountry: 'DE' },
      });
      expect(privacyMissing(FULL_IMPRINT, self, TEST_AUTHORITIES)).toEqual([]);

      const provider = privacy({
        hosting: { operator: 'provider', provider: null, serverCountry: 'DE', dpaConcluded: null },
        identityServer: { operator: 'provider', provider: { name: 'IdP', address: null }, serverCountry: 'DE' },
      });
      expect(privacyMissing(FULL_IMPRINT, provider, TEST_AUTHORITIES)).toEqual([
        'privacy.hosting.provider.name',
        'privacy.hosting.provider.address',
        'privacy.hosting.dpaConcluded',
        'privacy.identityServer.provider.address',
      ]);
    });

    it('a hoster without data processing agreement is a warning, not a gap', () => {
      const noDpa = privacy({ hosting: { ...FULL_PRIVACY.hosting, dpaConcluded: false } });
      expect(privacyMissing(FULL_IMPRINT, noDpa, TEST_AUTHORITIES)).toEqual([]);
      expect(privacyWarnings({ mode: 'generated', url: null }, noDpa)).toEqual(['hosting-without-dpa']);
      expect(privacyWarnings({ mode: 'link', url: 'https://x.example' }, noDpa)).toEqual([]);
      expect(privacyWarnings({ mode: 'generated', url: null }, FULL_PRIVACY)).toEqual([]);
      const self = privacy({ hosting: { operator: 'self', provider: null, serverCountry: 'DE', dpaConcluded: false } });
      expect(privacyWarnings({ mode: 'generated', url: null }, self)).toEqual([]);
    });

    it('accepts 0 days as a retention period', () => {
      expect(privacyMissing(FULL_IMPRINT, privacy({ serverLogRetentionDays: 0, backupRetentionDays: 0 }), TEST_AUTHORITIES)).toEqual([]);
    });

    it('blocks publishing while the authority of the state is not verified', () => {
      expect(privacyMissing(FULL_IMPRINT, privacy({ state: 'BY' }), TEST_AUTHORITIES)).toEqual(['privacy.supervisoryAuthority']);
      expect(privacyMissing(FULL_IMPRINT, privacy({ state: 'HH' }), TEST_AUTHORITIES)).toEqual(['privacy.supervisoryAuthority']);
    });

    it('needs name and contact of a data protection officer once one is added', () => {
      const missing = privacyMissing(FULL_IMPRINT, privacy({ dataProtectionOfficer: { name: 'X', contact: null } }), TEST_AUTHORITIES);
      expect(missing).toEqual(['privacy.dataProtectionOfficer.contact']);
    });
  });

  describe('request validation', () => {
    const body = (imprintData: unknown) => ({
      imprint: { mode: 'generated', url: null },
      privacy: { mode: null, url: null },
      imprintData,
      privacyData: EMPTY_PRIVACY_DATA,
    });

    it('accepts an incomplete form', () => {
      expect(updateLegalSettingsBodySchema.safeParse(body(EMPTY_IMPRINT_DATA)).success).toBe(true);
    });

    it('rejects a PO box as seat with the code po_box', () => {
      const result = updateLegalSettingsBodySchema.safeParse(body({ ...FULL_IMPRINT, address: { ...FULL_IMPRINT.address, street: 'Postfach 12 34' } }));
      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual([expect.objectContaining({ path: ['imprintData', 'address', 'street'], message: 'po_box' })]);
    });

    it('accepts server locations in the EU/EEA only (not_eea)', () => {
      const withCountry = (serverCountry: string) => ({
        ...body(EMPTY_IMPRINT_DATA),
        privacyData: { ...EMPTY_PRIVACY_DATA, hosting: { ...EMPTY_PRIVACY_DATA.hosting, serverCountry } },
      });
      for (const ok of ['DE', 'at', 'NO', 'IS']) expect(updateLegalSettingsBodySchema.safeParse(withCountry(ok)).success, ok).toBe(true);
      for (const no of ['CH', 'US', 'GB']) {
        const result = updateLegalSettingsBodySchema.safeParse(withCountry(no));
        expect(result.error?.issues[0]).toMatchObject({ path: ['privacyData', 'hosting', 'serverCountry'], message: 'not_eea' });
      }
    });

    it('rejects links other than http(s)', () => {
      const result = updateLegalSettingsBodySchema.safeParse({ ...body(EMPTY_IMPRINT_DATA), imprint: { mode: 'link', url: 'javascript:alert(1)' } });
      expect(result.success).toBe(false);
    });
  });
});
