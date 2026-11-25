import type { ImprintData, LegalDocument, PrivacyData } from '@vm-web/shared';
import type { AcceptedLegalTemplate } from '../db/schema';
import type { ILegalTemplateSource } from '../legal/legal-template-source';
import { loadShippedTemplate } from '../legal/legal-templates';
import type { SupervisoryAuthorities } from '../legal/supervisory-authorities';

/** Complete imprint data of a fictitious club (S-7). */
export const FULL_IMPRINT: ImprintData = {
  legalName: 'Musikverein Harmonie Talheim e.V.',
  address: { street: 'Hauptstraße 12', postalCode: '74388', city: 'Talheim' },
  representatives: [
    {
      name: 'Sandra Kessler',
      role: '1. Vorsitzende',
      address: { street: 'Lindenweg 3', postalCode: '74388', city: 'Talheim' },
      email: 'sandra.kessler@mv-talheim.example',
      phone: '+49 7133 222333',
    },
    { name: 'Jonas Weber', role: '2. Vorsitzender', address: null, email: null, phone: null },
  ],
  email: 'vorstand@mv-talheim.example',
  phone: '+49 7133 123456',
  isRegistered: true,
  registerCourt: 'Amtsgericht Stuttgart',
  registerNumber: 'VR 123456',
  vatId: 'DE123456789',
  contentResponsible: { name: 'Sandra Kessler', address: { street: 'Hauptstraße 12', postalCode: '74388', city: 'Talheim' } },
  department: null,
};

/** The club as department of a parent club (Musikzug of a Schützenverein), contact via the department. */
export const DEPARTMENT_IMPRINT: ImprintData = {
  ...FULL_IMPRINT,
  legalName: 'Bürger-Schützen-Verein Talheim e.V.',
  representatives: [
    { name: 'Peter Brandt', role: 'Oberst', address: null, email: null, phone: null },
    { name: 'Lea Hoffmann', role: 'Geschäftsführerin', address: null, email: null, phone: null },
  ],
  email: null,
  phone: null,
  department: {
    name: 'Musikzug Talheim',
    email: null,
    phone: null,
    contacts: [
      {
        name: 'Sandra Kessler',
        role: 'Vorsitzende des Musikzugs',
        address: { street: 'Lindenweg 3', postalCode: '74388', city: 'Talheim' },
        email: 'musikzug@mv-talheim.example',
        phone: '+49 7133 222333',
      },
    ],
  },
};

/** Complete privacy data with external hoster and identity server. */
export const FULL_PRIVACY: PrivacyData = {
  dataProtectionOfficer: { name: 'Petra Datenschutz', contact: 'datenschutz@mv-talheim.example' },
  hosting: { operator: 'provider', provider: { name: 'Beispiel Hosting GmbH', address: 'Serverweg 1, 90402 Nürnberg' }, serverCountry: 'DE', dpaConcluded: true },
  identityServer: { operator: 'provider', provider: { name: 'Login Dienst GmbH', address: 'Anmeldeweg 2, 10115 Berlin' }, serverCountry: 'DE' },
  serverLogRetentionDays: 14,
  backupRetentionDays: 30,
  state: 'BW',
  additionalText: 'Fotos von Konzerten veröffentlichen wir nur mit Einwilligung.\n\nFragen gerne an den Vorstand.',
};

/** Verified test entry for BW, so the privacy policy can be published in tests. */
export const TEST_AUTHORITIES: SupervisoryAuthorities = {
  BW: { name: 'Test-Aufsichtsbehörde Baden-Württemberg', address: 'Teststraße 1, 70000 Stuttgart', website: 'https://aufsicht.example' },
  BY: { name: 'Test-Landesamt', address: 'TODO: prüfen', website: 'https://by.example' },
};

/** Shipped templates with a test authority list; `bump()` simulates an update with a new template version. */
export class TestLegalTemplateSource implements ILegalTemplateSource {
  private readonly templates: Record<LegalDocument, AcceptedLegalTemplate> = {
    imprint: loadShippedTemplate('imprint'),
    privacy: loadShippedTemplate('privacy'),
  };

  shipped(document: LegalDocument): AcceptedLegalTemplate {
    return this.templates[document];
  }

  authorities(): SupervisoryAuthorities {
    return TEST_AUTHORITIES;
  }

  /** New version whose text differs by `marker`. */
  bump(document: LegalDocument, marker: string): AcceptedLegalTemplate {
    const current = this.templates[document];
    this.templates[document] = {
      ...current,
      version: current.version + 1,
      date: '2027-03-01',
      main: current.main.replace(/^# (.*)$/m, `# $1\n\n${marker}`),
    };
    return this.templates[document];
  }
}
