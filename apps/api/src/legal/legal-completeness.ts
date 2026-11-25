import { contactGaps, hasAnyAddressPart, type ImprintData, type LegalAddress, type LegalDocumentSettings, type LegalMissingField, type LegalWarning, type PrivacyData } from '@vm-web/shared';
import { isVerified, type SupervisoryAuthorities } from './supervisory-authorities';

type Missing = LegalMissingField[];

const blank = (v: string | null | undefined) => v === null || v === undefined || v.trim() === '';

function addressMissing(a: LegalAddress, prefix: 'imprint.address'): Missing {
  const out: Missing = [];
  if (blank(a.street)) out.push(`${prefix}.street`);
  if (blank(a.postalCode)) out.push(`${prefix}.postalCode`);
  if (blank(a.city)) out.push(`${prefix}.city`);
  return out;
}

/**
 * Fields the provider/controller needs in both documents (§ 5 DDG, Art. 13 Abs. 1 lit. a DSGVO).
 * Address, e-mail and phone each come from the club or, where it has none, from at least one
 * person. For a department: the address of the parent club or a contact person, e-mail and phone
 * of the department or a contact person; the parent club's board needs no contact data.
 */
function controllerMissing(d: ImprintData): Missing {
  const out: Missing = [];
  if (blank(d.legalName)) out.push('imprint.legalName');
  // a partly filled club address must be complete
  if (hasAnyAddressPart(d.address)) out.push(...addressMissing(d.address, 'imprint.address'));
  if (!d.representatives.length) out.push('imprint.representatives');
  if (d.department) {
    if (blank(d.department.name)) out.push('imprint.department.name');
    const gaps = contactGaps({ address: d.address, email: d.department.email, phone: d.department.phone }, d.department.contacts);
    if (gaps.address) out.push('imprint.department.contact.address');
    if (gaps.email) out.push('imprint.department.contact.email');
    if (gaps.phone) out.push('imprint.department.contact.phone');
  } else {
    const gaps = contactGaps(d, d.representatives);
    if (gaps.address) out.push('imprint.contact.address');
    if (gaps.email) out.push('imprint.contact.email');
    if (gaps.phone) out.push('imprint.contact.phone');
  }
  return out;
}

/** Required fields of a generated imprint (S-7). */
export function imprintMissing(d: ImprintData): Missing {
  const out = controllerMissing(d);
  if (d.isRegistered) {
    if (blank(d.registerCourt)) out.push('imprint.registerCourt');
    if (blank(d.registerNumber)) out.push('imprint.registerNumber');
  }
  if (d.contentResponsible) {
    const c = d.contentResponsible;
    if (blank(c.name)) out.push('imprint.contentResponsible.name');
    if (blank(c.address.street) || blank(c.address.postalCode) || blank(c.address.city)) out.push('imprint.contentResponsible.address');
  }
  return out;
}

/** Required fields of a generated privacy policy (S-7). */
export function privacyMissing(imprint: ImprintData, d: PrivacyData, authorities: SupervisoryAuthorities): Missing {
  const out = controllerMissing(imprint);
  if (d.dataProtectionOfficer) {
    if (blank(d.dataProtectionOfficer.name)) out.push('privacy.dataProtectionOfficer.name');
    if (blank(d.dataProtectionOfficer.contact)) out.push('privacy.dataProtectionOfficer.contact');
  }
  const h = d.hosting;
  if (!h.operator) out.push('privacy.hosting.operator');
  if (h.operator === 'provider') {
    if (blank(h.provider?.name)) out.push('privacy.hosting.provider.name');
    if (blank(h.provider?.address)) out.push('privacy.hosting.provider.address');
    if (h.dpaConcluded === null) out.push('privacy.hosting.dpaConcluded');
  }
  if (!h.serverCountry) out.push('privacy.hosting.serverCountry');
  const i = d.identityServer;
  if (!i.operator) out.push('privacy.identityServer.operator');
  if (i.operator === 'provider') {
    if (blank(i.provider?.name)) out.push('privacy.identityServer.provider.name');
    if (blank(i.provider?.address)) out.push('privacy.identityServer.provider.address');
  }
  if (!i.serverCountry) out.push('privacy.identityServer.serverCountry');
  if (d.serverLogRetentionDays === null) out.push('privacy.serverLogRetentionDays');
  if (d.backupRetentionDays === null) out.push('privacy.backupRetentionDays');
  if (!d.state) out.push('privacy.state');
  else if (!isVerified(authorities[d.state])) out.push('privacy.supervisoryAuthority');
  return out;
}

/** Hints that do not block publishing: an external hoster without data processing agreement. */
export function privacyWarnings(settings: LegalDocumentSettings, d: PrivacyData): LegalWarning[] {
  if (settings.mode !== 'generated') return [];
  return d.hosting.operator === 'provider' && d.hosting.dpaConcluded === false ? ['hosting-without-dpa'] : [];
}

/** Missing fields of one document depending on its mode. */
export function documentMissing(settings: LegalDocumentSettings, generatedMissing: () => Missing): Missing {
  if (!settings.mode) return ['mode'];
  if (settings.mode === 'link') return settings.url ? [] : ['url'];
  return generatedMissing();
}
