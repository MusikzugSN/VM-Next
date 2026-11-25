import { hasAnyAddressPart, type ImprintData, type LegalModuleKey, type LegalPerson, type PrivacyData } from '@vm-web/shared';
import { escapeMarkdownBlock, escapeMarkdownInline, TrustedMarkdown, type TemplateContext } from './legal-renderer';
import type { SupervisoryAuthority } from './supervisory-authorities';
import { LEGAL_MODULES } from './legal-modules';

export interface LegalContextInput {
  imprint: ImprintData;
  privacy: PrivacyData;
  authority: SupervisoryAuthority | undefined;
  activeModules: readonly LegalModuleKey[];
  session: { idleDays: number; maxDays: number };
  /** ISO date of „Stand“. */
  asOf: string;
  templateVersion: number;
}

const regionNames = new Intl.DisplayNames(['de'], { type: 'region' });

/** German name of an ISO country code, `null` if not set. */
export function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** `2026-11-24` → `24.11.2026`. */
export function germanDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Only https/http URLs become links; everything else is shown as escaped text. */
function link(url: string): TrustedMarkdown {
  if (!/^https?:\/\/[^\s<>()]+$/i.test(url)) return new TrustedMarkdown(escapeMarkdownInline(url));
  return new TrustedMarkdown(`[${escapeMarkdownInline(url)}](${url})`);
}

const has = (v: string | null | undefined): v is string => !!v && v.trim() !== '';

/** „Telefon: …“ / „E-Mail: …“ lines for the given values, `null` if none is set. */
function contactLines(email: string | null, phone: string | null): TrustedMarkdown | null {
  const lines = [has(phone) ? `Telefon: ${escapeMarkdownInline(phone)}` : null, has(email) ? `E-Mail: ${escapeMarkdownInline(email)}` : null].filter(Boolean);
  return lines.length ? new TrustedMarkdown(lines.join('\n')) : null;
}

/** One block per person: „Name, Funktion“, then address, phone and e-mail if given; blocks separated by a blank line. */
function personList(persons: readonly LegalPerson[]): TrustedMarkdown | null {
  if (!persons.length) return null;
  const blocks = persons.map((p) => {
    const lines = [`${escapeMarkdownInline(p.name)}, ${escapeMarkdownInline(p.role)}`];
    const a = p.address;
    if (a && (has(a.street) || has(a.postalCode) || has(a.city))) {
      lines.push(escapeMarkdownInline([a.street, [a.postalCode, a.city].filter(has).join(' ')].filter(has).join(', ')));
    }
    const contact = contactLines(p.email, p.phone);
    if (contact) lines.push(contact.markdown);
    return lines.join('\n');
  });
  return new TrustedMarkdown(blocks.join('\n\n'));
}

/**
 * Values for the templates (see `defaults/legal/README.md`). Club data stays plain strings and is
 * escaped by the renderer; only lists and links built here are `TrustedMarkdown`.
 */
export function buildLegalContext(input: LegalContextInput): TemplateContext {
  const { imprint, privacy, authority } = input;
  const hostingProvider = privacy.hosting.operator === 'provider';
  const idpProvider = privacy.identityServer.operator === 'provider';

  return {
    imprint: {
      ...(imprint as unknown as TemplateContext),
      representativesList: personList(imprint.representatives),
      /** The club's seat is optional when a person gives an address (S-7). */
      hasAddress: hasAnyAddressPart(imprint.address),
      /** Phone and e-mail of the club under its address; for a department they belong to the department. */
      clubContactLines: imprint.department ? null : contactLines(imprint.email, imprint.phone),
      department: imprint.department
        ? {
            ...(imprint.department as unknown as TemplateContext),
            contactsList: personList(imprint.department.contacts),
            contactLines: contactLines(imprint.department.email, imprint.department.phone),
          }
        : null,
    },
    privacy: {
      ...(privacy as unknown as TemplateContext),
      hosting: {
        ...(privacy.hosting as unknown as TemplateContext),
        provider: privacy.hosting.provider ?? { name: null, address: null },
        isProvider: hostingProvider,
        countryName: countryName(privacy.hosting.serverCountry),
      },
      identityServer: {
        ...(privacy.identityServer as unknown as TemplateContext),
        provider: privacy.identityServer.provider ?? { name: null, address: null },
        isProvider: idpProvider,
        countryName: countryName(privacy.identityServer.serverCountry),
      },
      anyProvider: hostingProvider || idpProvider,
      additionalText: privacy.additionalText?.trim() ? escapeMarkdownBlock(privacy.additionalText) : null,
    },
    authority: authority
      ? { name: authority.name, address: authority.address, website: link(authority.website) }
      : { name: null, address: null, website: null },
    session: { idleDays: input.session.idleDays, maxDays: input.session.maxDays },
    module: Object.fromEntries(LEGAL_MODULES.map((m) => [m.key, input.activeModules.includes(m.key)])),
    meta: { asOf: germanDate(input.asOf), templateVersion: input.templateVersion },
  };
}
