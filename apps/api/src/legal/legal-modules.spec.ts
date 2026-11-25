import { FULL_IMPRINT, FULL_PRIVACY, TEST_AUTHORITIES } from '../testing/legal-fixtures';
import { buildLegalContext } from './legal-context';
import { markdownToHtml } from './legal-markdown';
import { activeModules, composePrivacyTemplate, LEGAL_MODULES } from './legal-modules';
import { parseTemplate, renderTemplate } from './legal-renderer';
import { loadShippedTemplate } from './legal-templates';

const privacyTemplate = loadShippedTemplate('privacy');

function renderPrivacy(printServiceConfigured: boolean): string {
  const active = activeModules({ printServiceConfigured });
  const context = buildLegalContext({
    imprint: FULL_IMPRINT,
    privacy: FULL_PRIVACY,
    authority: TEST_AUTHORITIES.BW,
    activeModules: active,
    session: { idleDays: 14, maxDays: 90 },
    asOf: '2026-11-24',
    templateVersion: privacyTemplate.version,
  });
  return markdownToHtml(renderTemplate(parseTemplate(composePrivacyTemplate(privacyTemplate, active)), context).markdown);
}

describe('legal modules (S-7)', () => {
  it('registers base first and the prepared modules', () => {
    expect(LEGAL_MODULES.map((m) => m.key)).toEqual(['base', 'library', 'print-service', 'members', 'notifications']);
  });

  it('base and library are always active, the print service only with its VM-Web address', () => {
    expect(activeModules({ printServiceConfigured: false })).toEqual(['base', 'library']);
    expect(activeModules({ printServiceConfigured: true })).toEqual(['base', 'library', 'print-service']);
  });

  it('never activates member management or notifications yet', () => {
    for (const printServiceConfigured of [true, false]) {
      expect(activeModules({ printServiceConfigured })).not.toContain('members');
      expect(activeModules({ printServiceConfigured })).not.toContain('notifications');
    }
  });

  it('shows the sections of the active modules only', () => {
    const without = renderPrivacy(false);
    expect(without).toContain('<h2>Notenbereich</h2>');
    expect(without).not.toContain('Druckservice');

    const withPrint = renderPrivacy(true);
    expect(withPrint).toContain('<h2>Lokaler Druckservice</h2>');
    expect(withPrint.indexOf('Notenbereich')).toBeLessThan(withPrint.indexOf('Lokaler Druckservice'));
    // module sections sit between cookies and recipients
    expect(withPrint.indexOf('<h2>Cookies</h2>')).toBeLessThan(withPrint.indexOf('Notenbereich'));
    expect(withPrint.indexOf('Lokaler Druckservice')).toBeLessThan(withPrint.indexOf('<h2>Empfänger</h2>'));
  });

  it('always contains the base sections', () => {
    const html = renderPrivacy(false);
    for (const heading of ['Verantwortlicher', 'Hosting und Server-Logs', 'Anmeldung über das Vereinskonto', 'Cookies', 'Speicherdauer', 'Ihre Rechte', 'Beschwerderecht']) {
      expect(html).toContain(`<h2>${heading}</h2>`);
    }
  });

  it('composes without the slot left behind', () => {
    expect(composePrivacyTemplate(privacyTemplate, ['base'])).not.toContain('{{> modules}}');
  });
});
