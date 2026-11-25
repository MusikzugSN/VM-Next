import * as z from 'zod';
import { isoDateSchema, isoDateTimeSchema } from '../common/ids.schema';

/*
 * Impressum & Datenschutzerklärung (S-7).
 *
 * Stored data is deliberately lenient: every field may be `null`, so admins can save a half-filled
 * form. Format rules (e-mail, postal code, no PO box …) apply as soon as a value is given.
 * Whether a document is complete enough to be published is a separate check on the server
 * that returns `missingFields` (codes below) – it is not part of these schemas.
 */

// ---------------------------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------------------------

/** The two legal documents. */
export const legalDocumentSchema = z.enum(['imprint', 'privacy']);
export type LegalDocument = z.infer<typeof legalDocumentSchema>;

/** `link`: external URL (as before, S-4). `generated`: rendered by VM-Web from club data and templates. */
export const legalModeSchema = z.enum(['link', 'generated']);
export type LegalMode = z.infer<typeof legalModeSchema>;

/** German federal states (ISO 3166-2:DE without `DE-`). Selects the supervisory authority. */
export const germanStateSchema = z.enum([
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
]);
export type GermanState = z.infer<typeof germanStateSchema>;

/**
 * Sections VM-Web contributes to the privacy policy (`LegalModule` registry on the server).
 * `base` is always active; `members` and `notifications` are prepared but not yet available.
 */
export const legalModuleKeySchema = z.enum(['base', 'library', 'print-service', 'members', 'notifications']);
export type LegalModuleKey = z.infer<typeof legalModuleKeySchema>;

/** Template version as written in the front matter of the template files: integer, counts up. */
export const legalTemplateVersionSchema = z.number().int().min(1);

/**
 * Detects PO boxes: „Postfach 12 34“, „Postf. 1234“, „PF 1234“, „P.O. Box 12“.
 * „Pfarrgasse 3“ or „Am Pfahl 2“ are no match.
 */
export const PO_BOX_PATTERN = /\bpostf(?:ach|\.)|(?:^|\s)pf\b\.?|\bp\.?\s?o\.?\s?box\b/i;

const text = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) => text(max).nullable();

/**
 * Street and number of a seat – never a PO box. The refinement message is the business code
 * `po_box` in `errors[].code` (the validation pipe maps custom issues to their message, step 2).
 */
export const streetSchema = text(200).refine((v) => !PO_BOX_PATTERN.test(v), { message: 'po_box' });

/** German postal code, five digits. */
export const postalCodeSchema = z.string().trim().regex(/^\d{5}$/);

/** Phone number: digits, spaces, `+ / ( ) -`, at least 6 digits. */
export const phoneSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^\+?[\d\s/()-]+$/)
  .refine((v) => v.replace(/\D/g, '').length >= 6, { message: 'too_short' });

/**
 * Server locations VM-Web supports: EU and EEA (ISO 3166-1 alpha-2), Germany first.
 * Locations outside would need a section on third-country transfers (Art. 44 ff. DSGVO), which the
 * templates do not have – decided for S-7: only EU/EEA.
 */
export const EEA_COUNTRY_CODES = [
  'DE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT',
  'RO', 'SE', 'SI', 'SK', 'IS', 'LI', 'NO',
] as const;

/** Country of a server as ISO code; only EU/EEA (`not_eea` otherwise). */
export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/)
  .refine((v) => (EEA_COUNTRY_CODES as readonly string[]).includes(v), { message: 'not_eea' });

// ---------------------------------------------------------------------------------------------
// Club data
// ---------------------------------------------------------------------------------------------

export const legalAddressSchema = z.object({
  street: streetSchema.nullable(),
  postalCode: postalCodeSchema.nullable(),
  city: nullableText(100),
});
export type LegalAddress = z.infer<typeof legalAddressSchema>;

/**
 * A person in the imprint: board member (§ 26 BGB) or contact person of a department, e.g.
 * „Sandra Kessler, 1. Vorsitzende“. Contact data is optional per person; it stands in for the
 * club's address, e-mail or phone where the club has none (see `contactGaps`). Defaults keep older
 * stored data readable.
 */
export const legalPersonSchema = z.object({
  name: text(100),
  role: text(100),
  address: legalAddressSchema.nullable().default(null),
  email: z.email().max(200).nullable().default(null),
  phone: phoneSchema.nullable().default(null),
});
export type LegalPerson = z.infer<typeof legalPersonSchema>;

/**
 * The club is a department of another (registered) club, e.g. the Musikzug of a Schützenverein.
 * Then `legalName`, `address`, `representatives` and the register describe the parent club (the
 * provider); the department adds its name and its own e-mail, phone and contact persons.
 */
export const legalDepartmentSchema = z.object({
  name: nullableText(200),
  email: z.email().max(200).nullable(),
  phone: phoneSchema.nullable(),
  contacts: z.array(legalPersonSchema).max(10),
});
export type LegalDepartment = z.infer<typeof legalDepartmentSchema>;

const blankValue = (v: string | null | undefined) => v === null || v === undefined || v.trim() === '';

/** An address with street, postal code and city. */
export function isCompleteAddress(a: LegalAddress | null | undefined): boolean {
  return !!a && !blankValue(a.street) && !blankValue(a.postalCode) && !blankValue(a.city);
}

/** An address where at least one part is filled in. */
export function hasAnyAddressPart(a: LegalAddress | null | undefined): boolean {
  return !!a && (!blankValue(a.street) || !blankValue(a.postalCode) || !blankValue(a.city));
}

/** Address, e-mail and phone of a person are all given. */
export function isCompleteContact(p: Pick<LegalPerson, 'address' | 'email' | 'phone'>): boolean {
  return isCompleteAddress(p.address) && !blankValue(p.email) && !blankValue(p.phone);
}

/** Which kind of § 5 DDG contact data is still missing: `true` = neither the club nor any person has it. */
export interface ContactGaps {
  address: boolean;
  email: boolean;
  phone: boolean;
}

/**
 * § 5 DDG contact, checked per kind (S-7): address, e-mail and phone each come from the club – or,
 * where the club has none, from at least one person (not necessarily the same one).
 * A partly filled club address counts as given; its missing parts are reported separately.
 */
export function contactGaps(
  unit: { address: LegalAddress | null; email: string | null; phone: string | null },
  persons: readonly LegalPerson[],
): ContactGaps {
  return {
    address: !hasAnyAddressPart(unit.address) && !persons.some((p) => isCompleteAddress(p.address)),
    email: blankValue(unit.email) && !persons.some((p) => !blankValue(p.email)),
    phone: blankValue(unit.phone) && !persons.some((p) => !blankValue(p.phone)),
  };
}

/** Imprint data (§ 5 DDG). The privacy policy takes the controller from here. */
export const imprintDataSchema = z.object({
  /** Full name including legal form, e.g. „Musikverein Harmonie Talheim e.V.“. */
  legalName: nullableText(200),
  /** Seat of the club. Optional: without it, at least one person needs an address (`contactGaps`). */
  address: legalAddressSchema,
  /** Board (§ 26 BGB), at least one for a complete imprint; of the parent club for a department. */
  representatives: z.array(legalPersonSchema).max(10),
  /** Optional: without it, at least one person needs an e-mail address (`contactGaps`). */
  email: z.email().max(200).nullable(),
  phone: phoneSchema.nullable(),
  /** Registered association (e.V.): register court and number are required, otherwise hidden. */
  isRegistered: z.boolean(),
  registerCourt: nullableText(100),
  registerNumber: nullableText(50),
  /** Optional, e.g. `DE123456789`. */
  vatId: z.string().trim().toUpperCase().regex(/^[A-Z]{2}[A-Z0-9]{2,12}$/).nullable(),
  /** Optional: person responsible for content according to § 18 Abs. 2 MStV (name and address). */
  contentResponsible: z
    .object({ name: nullableText(100), address: legalAddressSchema })
    .nullable(),
  /** Set when the club is a department of a parent club (see `legalDepartmentSchema`). */
  department: legalDepartmentSchema.nullable().default(null),
});
export type ImprintData = z.infer<typeof imprintDataSchema>;

/** Who runs a service: the club itself or a provider. */
export const legalOperatorSchema = z.enum(['self', 'provider']);
export type LegalOperator = z.infer<typeof legalOperatorSchema>;

/** A service provider (hoster, identity server operator). Address as one line, the provider may be abroad. */
export const legalProviderSchema = z.object({
  name: nullableText(200),
  address: nullableText(300),
});
export type LegalProvider = z.infer<typeof legalProviderSchema>;

/** Privacy policy data. The controller is taken from the imprint data and not stored twice. */
export const privacyDataSchema = z.object({
  /** Optional data protection officer. */
  dataProtectionOfficer: z.object({ name: nullableText(100), contact: nullableText(300) }).nullable(),
  hosting: z.object({
    operator: legalOperatorSchema.nullable(),
    /** Only with `operator: 'provider'`. */
    provider: legalProviderSchema.nullable(),
    /** Server location; with `self` the location of the club's server. */
    serverCountry: countryCodeSchema.nullable(),
    /** Data processing agreement (Art. 28 DSGVO) concluded – only with `provider`. */
    dpaConcluded: z.boolean().nullable(),
  }),
  identityServer: z.object({
    operator: legalOperatorSchema.nullable(),
    provider: legalProviderSchema.nullable(),
    serverCountry: countryCodeSchema.nullable(),
  }),
  serverLogRetentionDays: z.number().int().min(0).max(3650).nullable(),
  backupRetentionDays: z.number().int().min(0).max(3650).nullable(),
  /** Federal state of the club's seat → supervisory authority. */
  state: germanStateSchema.nullable(),
  /**
   * Optional additions, inserted as last section. Plain text: blank lines separate paragraphs,
   * no Markdown, no HTML – everything is escaped.
   */
  additionalText: z.string().trim().max(10000).nullable(),
});
export type PrivacyData = z.infer<typeof privacyDataSchema>;

/** Mode and link of one document. `url` is only used with `mode: 'link'`, but kept when switching. */
export const legalDocumentSettingsSchema = z.object({
  mode: legalModeSchema.nullable(),
  url: z.url({ protocol: /^https?$/ }).max(500).nullable(),
});
export type LegalDocumentSettings = z.infer<typeof legalDocumentSettingsSchema>;

// ---------------------------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------------------------

/**
 * Codes of missing required fields, shown as list in the configuration.
 * Paths follow the data structure; `imprint.*` fields also count for the privacy policy (controller).
 */
export const legalMissingFieldSchema = z.enum([
  'mode',
  'url',
  'imprint.legalName',
  'imprint.address.street',
  'imprint.address.postalCode',
  'imprint.address.city',
  'imprint.representatives',
  /** Neither the club nor any board member has an address / e-mail / phone. */
  'imprint.contact.address',
  'imprint.contact.email',
  'imprint.contact.phone',
  'imprint.department.name',
  /** Department: neither the parent club nor any contact person has an address; neither the department nor a contact person e-mail / phone. */
  'imprint.department.contact.address',
  'imprint.department.contact.email',
  'imprint.department.contact.phone',
  'imprint.registerCourt',
  'imprint.registerNumber',
  'imprint.contentResponsible.name',
  'imprint.contentResponsible.address',
  'privacy.dataProtectionOfficer.name',
  'privacy.dataProtectionOfficer.contact',
  'privacy.hosting.operator',
  'privacy.hosting.provider.name',
  'privacy.hosting.provider.address',
  'privacy.hosting.serverCountry',
  'privacy.hosting.dpaConcluded',
  'privacy.identityServer.operator',
  'privacy.identityServer.provider.name',
  'privacy.identityServer.provider.address',
  'privacy.identityServer.serverCountry',
  'privacy.serverLogRetentionDays',
  'privacy.backupRetentionDays',
  'privacy.state',
  /** The shipped list has no verified data for this state yet (`TODO: prüfen`). */
  'privacy.supervisoryAuthority',
]);
export type LegalMissingField = z.infer<typeof legalMissingFieldSchema>;

/**
 * `not-configured`: no mode chosen. `incomplete`: required data missing, not published.
 * `published`: reachable publicly (link set or generated document complete).
 */
export const legalDocumentStatusSchema = z.enum(['not-configured', 'incomplete', 'published']);
export type LegalDocumentStatus = z.infer<typeof legalDocumentStatusSchema>;

/** Template versions of one document. */
export const legalTemplateStateSchema = z.object({
  /** Version in effect; `null` until the document was generated for the first time. */
  acceptedVersion: legalTemplateVersionSchema.nullable(),
  acceptedAt: isoDateTimeSchema.nullable(),
  /** Version shipped with this VM-Web release. */
  availableVersion: legalTemplateVersionSchema,
  availableDate: isoDateSchema,
  /** `availableVersion > acceptedVersion`: admins see „Neue Vorlage verfügbar – bitte prüfen“. */
  updateAvailable: z.boolean(),
});
export type LegalTemplateState = z.infer<typeof legalTemplateStateSchema>;

const legalDocumentStateSchema = legalDocumentSettingsSchema.extend({
  status: legalDocumentStatusSchema,
  missingFields: z.array(legalMissingFieldSchema),
  template: legalTemplateStateSchema,
});

// ---------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------

/**
 * Hints that do not block publishing (S-7).
 * `hosting-without-dpa`: external hoster, but no data processing agreement (Art. 28 DSGVO).
 */
export const legalWarningSchema = z.enum(['hosting-without-dpa']);
export type LegalWarning = z.infer<typeof legalWarningSchema>;

/** GET system/legal/settings – tab „Rechtliches“ (S-7). */
export const legalSettingsResponseSchema = z.object({
  imprint: legalDocumentStateSchema,
  privacy: legalDocumentStateSchema,
  imprintData: imprintDataSchema,
  privacyData: privacyDataSchema,
  /** Modules active in this installation, in the order of the privacy policy. */
  activeModules: z.array(legalModuleKeySchema),
  warnings: z.array(legalWarningSchema),
  updatedAt: isoDateTimeSchema.nullable(),
});
export type LegalSettingsResponse = z.infer<typeof legalSettingsResponseSchema>;

/** POST system/legal/update-settings → 204. Always the complete form; incomplete data is allowed. */
export const updateLegalSettingsBodySchema = z.object({
  imprint: legalDocumentSettingsSchema,
  privacy: legalDocumentSettingsSchema,
  imprintData: imprintDataSchema,
  privacyData: privacyDataSchema,
});
export type UpdateLegalSettingsBody = z.infer<typeof updateLegalSettingsBodySchema>;

/**
 * POST system/legal/preview – renders unsaved data.
 * `templateVersion: 'available'` shows the new template before it is accepted.
 */
export const legalPreviewBodySchema = updateLegalSettingsBodySchema
  .pick({ imprintData: true, privacyData: true })
  .extend({
    document: legalDocumentSchema,
    templateVersion: z.enum(['accepted', 'available']).default('accepted'),
  });
export type LegalPreviewBody = z.infer<typeof legalPreviewBodySchema>;

export const legalPreviewResponseSchema = z.object({
  html: z.string(),
  templateVersion: legalTemplateVersionSchema,
  templateDate: isoDateSchema,
  missingFields: z.array(legalMissingFieldSchema),
});
export type LegalPreviewResponse = z.infer<typeof legalPreviewResponseSchema>;

/**
 * POST system/legal/accept-template-version → 204.
 * `version` must equal the available version (guards against accepting something not previewed).
 */
export const acceptLegalTemplateBodySchema = z.object({
  document: legalDocumentSchema,
  version: legalTemplateVersionSchema,
});
export type AcceptLegalTemplateBody = z.infer<typeof acceptLegalTemplateBodySchema>;

/** GET system/legal/status – small block for warnings (configuration, admin start page). */
export const legalStatusResponseSchema = z.object({
  imprint: legalDocumentStatusSchema,
  privacy: legalDocumentStatusSchema,
  templateUpdateAvailable: z.boolean(),
});
export type LegalStatusResponse = z.infer<typeof legalStatusResponseSchema>;

/** GET public/legal/imprint | public/legal/privacy – without session. */
export const publicLegalDocumentResponseSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('link'), url: z.url() }),
  z.object({
    mode: z.literal('generated'),
    /** Sanitised HTML rendered on the server. */
    html: z.string(),
    /** „Stand“: date of the last change of data or template. */
    asOf: isoDateSchema,
    templateVersion: legalTemplateVersionSchema,
  }),
  /** Not configured or incomplete: the page shows a neutral notice. */
  z.object({ mode: z.literal('unavailable') }),
]);
export type PublicLegalDocumentResponse = z.infer<typeof publicLegalDocumentResponseSchema>;

/**
 * Where links to a document point (login page, footer, user menu).
 * `external`: link mode, opens the URL. `internal`: VM-Web page `/impressum` or `/datenschutz`.
 */
export const legalLinkSchema = z.object({
  kind: z.enum(['external', 'internal']),
  href: z.string(),
});
export type LegalLink = z.infer<typeof legalLinkSchema>;

// ---------------------------------------------------------------------------------------------
// Empty forms
// ---------------------------------------------------------------------------------------------

/** Imprint data before anything was entered. Registered association is the common case. */
export const EMPTY_IMPRINT_DATA: ImprintData = {
  legalName: null,
  address: { street: null, postalCode: null, city: null },
  representatives: [],
  email: null,
  phone: null,
  isRegistered: true,
  registerCourt: null,
  registerNumber: null,
  vatId: null,
  contentResponsible: null,
  department: null,
};

export const EMPTY_PRIVACY_DATA: PrivacyData = {
  dataProtectionOfficer: null,
  hosting: { operator: null, provider: null, serverCountry: null, dpaConcluded: null },
  identityServer: { operator: null, provider: null, serverCountry: null },
  serverLogRetentionDays: null,
  backupRetentionDays: null,
  state: null,
  additionalText: null,
};
