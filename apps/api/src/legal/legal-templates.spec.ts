import { EMPTY_IMPRINT_DATA, EMPTY_PRIVACY_DATA, germanStateSchema, type LegalDocument } from '@vm-web/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEPARTMENT_IMPRINT, FULL_IMPRINT, FULL_PRIVACY, TEST_AUTHORITIES } from '../testing/legal-fixtures';
import { buildLegalContext } from './legal-context';
import { markdownToHtml } from './legal-markdown';
import { composePrivacyTemplate, LEGAL_MODULES } from './legal-modules';
import { parseTemplate, renderTemplate } from './legal-renderer';
import { legalDir, loadShippedTemplate, parseTemplateFile, templateHash } from './legal-templates';
import { isVerified, loadSupervisoryAuthorities } from './supervisory-authorities';

const ALL_MODULES = LEGAL_MODULES.map((m) => m.key);

function render(document: LegalDocument, full: boolean, imprint = FULL_IMPRINT) {
  const template = loadShippedTemplate(document);
  const source = document === 'privacy' ? composePrivacyTemplate(template, ALL_MODULES) : template.main;
  const context = buildLegalContext({
    imprint: full ? imprint : EMPTY_IMPRINT_DATA,
    privacy: full ? FULL_PRIVACY : EMPTY_PRIVACY_DATA,
    authority: full ? TEST_AUTHORITIES.BW : undefined,
    activeModules: ALL_MODULES,
    session: { idleDays: 14, maxDays: 90 },
    asOf: '2026-11-24',
    templateVersion: template.version,
  });
  return renderTemplate(parseTemplate(source), context);
}

describe('shipped legal templates (S-7)', () => {
  it.each(['imprint', 'privacy'] as const)('%s renders with complete data without gaps or unknown placeholders', (document) => {
    const { markdown, missing } = render(document, true);
    expect(missing).toEqual([]);
    expect(markdownToHtml(markdown)).toContain('Musikverein Harmonie Talheim e.V.');
  });

  it.each(['imprint', 'privacy'] as const)('%s renders an empty form for the preview', (document) => {
    expect(render(document, false).missing.length).toBeGreaterThan(0);
  });

  it('shows „Stand“ and the template version', () => {
    const html = markdownToHtml(render('imprint', true).markdown);
    expect(html).toContain('Stand: 24.11.2026 · Vorlage Version 1');
  });

  it('imprint contains the required sections', () => {
    const html = markdownToHtml(render('imprint', true).markdown);
    expect(html).toContain('Angaben gemäß § 5 DDG');
    // persons with their contact data, one paragraph each
    expect(html).toContain(
      '<p>Sandra Kessler, 1. Vorsitzende<br />\nLindenweg 3, 74388 Talheim<br />\nTelefon: +49 7133 222333<br />\nE-Mail: sandra.kessler@mv-talheim.example</p>\n<p>Jonas Weber, 2. Vorsitzender</p>',
    );
    // phone and e-mail of the club directly under its address, no own section
    expect(html).toContain(
      '<p>Musikverein Harmonie Talheim e.V.<br />\nHauptstraße 12<br />\n74388 Talheim<br />\nTelefon: +49 7133 123456<br />\nE-Mail: vorstand@mv-talheim.example</p>',
    );
    expect(html).not.toContain('<h2>Kontakt</h2>');
    expect(html).toContain('Registernummer: VR 123456');
    expect(html).toContain('§ 18 Abs. 2 MStV');
  });

  it('shows only the club name when address, e-mail and phone come from persons', () => {
    const club = { ...FULL_IMPRINT, address: { street: null, postalCode: null, city: null }, email: null, phone: null };
    const { markdown, missing } = render('imprint', true, club);
    expect(missing).toEqual([]);
    const html = markdownToHtml(markdown);
    expect(html).toContain('<h2>Angaben gemäß § 5 DDG</h2>\n<p>Musikverein Harmonie Talheim e.V.</p>');
    expect(html).toContain('Lindenweg 3, 74388 Talheim<br />\nTelefon: +49 7133 222333');
  });

  it.each(['imprint', 'privacy'] as const)('%s names the parent club as provider and the department with its contact', (document) => {
    const { markdown, missing } = render(document, true, DEPARTMENT_IMPRINT);
    expect(missing).toEqual([]);
    const html = markdownToHtml(markdown);
    expect(html).toContain('Bürger-Schützen-Verein Talheim e.V.');
    expect(html).toContain('Musikzug Talheim');
    expect(html).toContain('Peter Brandt, Oberst');
    expect(html).toContain('Sandra Kessler, Vorsitzende des Musikzugs<br />\nLindenweg 3, 74388 Talheim');
    if (document === 'imprint') {
      expect(html).toContain('Anbieter im Sinne von § 5 DDG ist Bürger-Schützen-Verein Talheim e.V. (Trägerverein); Musikzug Talheim ist eine Abteilung dieses Vereins.');
      expect(html).not.toContain('e.V..');
      expect(html).toContain('<h2>Kontakt Musikzug Talheim</h2>');
    } else {
      expect(html).toContain('die Notenverwaltung von Musikzug Talheim, einer Abteilung von Bürger-Schützen-Verein Talheim e.V.');
    }
  });

  it('parses front matter and rejects broken files', () => {
    expect(parseTemplateFile('---\ndocument: imprint\nversion: 3\ndate: 2027-01-01\n---\n# X\n', 'x.md')).toMatchObject({ version: 3, module: null, body: '# X\n' });
    expect(() => parseTemplateFile('# X', 'x.md')).toThrow(/front matter/);
    expect(() => parseTemplateFile('---\ndocument: imprint\nversion: 0\ndate: 2027-01-01\n---\n', 'x.md')).toThrow(/version/);
  });

  /**
   * A changed template text needs a new version, otherwise installations would publish the new
   * text without „Übernehmen“. After changing a template: raise `version` and `date` in its front
   * matter and update `versions.lock.json` with the hash printed here.
   */
  it.each(['imprint', 'privacy'] as const)('%s: text changes come with a new version (versions.lock.json)', (document) => {
    const lock = JSON.parse(readFileSync(join(legalDir(), 'versions.lock.json'), 'utf8')) as Record<string, { version: number; sha256: string }>;
    const template = loadShippedTemplate(document);
    const hash = templateHash(template);
    expect({ version: template.version, sha256: hash }, `update versions.lock.json: ${document} → version ${template.version}, sha256 ${hash}`).toEqual(lock[document]);
  });

  it('lists all 16 states; unverified entries are marked TODO', () => {
    const authorities = loadSupervisoryAuthorities();
    expect(Object.keys(authorities).sort()).toEqual([...germanStateSchema.options].sort());
    for (const a of Object.values(authorities)) {
      expect(a.website).toMatch(/^https?:\/\//);
      if (!isVerified(a)) expect(a.address).toMatch(/TODO/);
    }
  });
});
