import {
  EEA_COUNTRY_CODES,
  germanStateSchema,
  updateLegalSettingsBodySchema,
  type GermanState,
  type ImprintData,
  type LegalDocument,
  type LegalDocumentSettings,
  type LegalMissingField,
  type LegalPerson,
  type LegalSettingsResponse,
  type PrivacyData,
  type UpdateLegalSettingsBody,
} from '@vm-web/shared';

/** Editable state of the tab „Rechtliches“ (S-7). Strings may be empty while typing. */
export interface LegalForm {
  imprint: LegalDocumentSettings;
  privacy: LegalDocumentSettings;
  imprintData: ImprintData;
  privacyData: PrivacyData;
}

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = ['imprint', 'privacy'];

/** A new, empty row of a person list (board or department contacts). */
export const emptyPerson = (): LegalPerson => ({ name: '', role: '', address: { street: '', postalCode: '', city: '' }, email: '', phone: '' });

export function formFromSettings(s: LegalSettingsResponse): LegalForm {
  return structuredClone({
    imprint: { mode: s.imprint.mode, url: s.imprint.url },
    privacy: { mode: s.privacy.mode, url: s.privacy.url },
    imprintData: s.imprintData,
    privacyData: s.privacyData,
  });
}

/** Trims every string and turns empty ones into `null` (the API wants `null` for „not set“). */
function cleanStrings<T>(value: T): T {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return (trimmed === '' ? null : trimmed) as T;
  }
  if (Array.isArray(value)) return value.map(cleanStrings) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanStrings(v)])) as T;
  }
  return value;
}

/** An address without any value is no address. */
function cleanPerson(p: LegalPerson): LegalPerson {
  const a = p.address;
  return a && a.street === null && a.postalCode === null && a.city === null ? { ...p, address: null } : p;
}

const isFilled = (p: LegalPerson) => p.name !== null || p.role !== null || p.address !== null || p.email !== null || p.phone !== null;

/**
 * Body for `update-settings` and `preview`: trimmed, empty → `null`, empty representative rows
 * dropped, provider fields only with an external provider.
 */
export function cleanForm(form: LegalForm): LegalForm {
  const f = cleanStrings(form);
  f.imprintData.representatives = f.imprintData.representatives.map(cleanPerson).filter(isFilled);
  if (f.imprintData.department) f.imprintData.department.contacts = f.imprintData.department.contacts.map(cleanPerson).filter(isFilled);
  const hosting = f.privacyData.hosting;
  if (hosting.operator !== 'provider') f.privacyData.hosting = { ...hosting, provider: null, dpaConcluded: null };
  const idp = f.privacyData.identityServer;
  if (idp.operator !== 'provider') f.privacyData.identityServer = { ...idp, provider: null };
  return f;
}

/** Validates the cleaned form like the API: field errors keyed by path (`imprintData/address/street`). */
export function validateForm(form: LegalForm): { body: UpdateLegalSettingsBody } | { errors: Record<string, string> } {
  const parsed = updateLegalSettingsBodySchema.safeParse(cleanForm(form));
  if (parsed.success) return { body: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('/');
    // refinements carry a business code (`po_box`, `too_short`), the rest the Zod code
    errors[key] ??= issue.code === 'custom' && /^[a-z_]+$/.test(issue.message) ? issue.message : issue.code;
  }
  return { errors };
}

/** Missing fields of a document in link mode (generated documents get them from the preview). */
export function linkMissing(settings: LegalDocumentSettings): LegalMissingField[] {
  if (!settings.mode) return ['mode'];
  return settings.mode === 'link' && !settings.url?.trim() ? ['url'] : [];
}

/** i18n key of a field label; also used for the list of missing fields. */
export const fieldLabelKey = (path: LegalMissingField | string) => `system.settings.legal.fields.${path}`;

/** Where the imprint data (also the controller of the privacy policy) is edited. */
export function imprintDataPlace(form: Pick<LegalForm, 'imprint' | 'privacy'>): LegalDocument | null {
  if (form.imprint.mode === 'generated') return 'imprint';
  if (form.privacy.mode === 'generated') return 'privacy';
  return null;
}

export const GERMAN_STATES: readonly GermanState[] = germanStateSchema.options;

/** Server locations to choose from: only EU/EEA (S-7), Germany first. */
export const COUNTRY_CODES: readonly string[] = EEA_COUNTRY_CODES;

const regionNames = new Intl.DisplayNames(['de'], { type: 'region' });
export const countryName = (code: string) => regionNames.of(code) ?? code;

/** A change of one value of a data form, e.g. `{ path: 'address.street', value: 'Weg 1' }`. */
export interface FieldChange {
  path: string;
  value: unknown;
}

/** Immutable update of a nested value: `setPath(data, 'address.street', 'Weg 1')`; numeric segments are array indexes. */
export function setPath<T>(data: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  const copy = (Array.isArray(data) ? [...data] : { ...(data as object) }) as Record<string, unknown>;
  copy[head] = rest.length ? setPath(copy[head], rest.join('.'), value) : value;
  return copy as T;
}

/** Person lists below `imprintData` whose rows are dropped from the preview when name or role is invalid. */
const PERSON_LISTS = ['representatives', 'department/contacts'];

/**
 * Data for the live preview: like `cleanForm`, but values that are still invalid while typing
 * (half an e-mail address, a PO box …) are left out, so the preview keeps working and lists them
 * as missing. Persons with an invalid name or role are dropped; their other invalid values are left out.
 */
export function previewForm(form: LegalForm): LegalForm {
  let current = cleanForm(form);
  for (let round = 0; round < 3; round++) {
    const result = validateForm(current);
    if ('body' in result) return current;
    const drop = new Map<string, Set<number>>();
    for (const path of Object.keys(result.errors)) {
      const list = PERSON_LISTS.find((l) => path.startsWith(`imprintData/${l}/`));
      if (list) {
        const [index, field] = path.slice(`imprintData/${list}/`.length).split('/');
        if (field === 'name' || field === 'role' || field === undefined) {
          drop.set(list, (drop.get(list) ?? new Set()).add(Number(index)));
          continue;
        }
      }
      current = setPath(current, path.split('/').join('.'), null);
    }
    for (const [list, indexes] of drop) {
      const dotted = `imprintData.${list.replace('/', '.')}`;
      const rows = list === 'representatives' ? current.imprintData.representatives : (current.imprintData.department?.contacts ?? []);
      current = setPath(current, dotted, rows.filter((_, i) => !indexes.has(i)));
    }
  }
  return current;
}
