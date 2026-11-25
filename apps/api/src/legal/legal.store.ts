import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EMPTY_IMPRINT_DATA,
  EMPTY_PRIVACY_DATA,
  imprintDataSchema,
  legalModeSchema,
  privacyDataSchema,
  type ImprintData,
  type LegalDocument,
  type LegalDocumentSettings,
  type PrivacyData,
} from '@vm-web/shared';
import { httpUrlOrNull } from '../common/url';
import { DATABASE, type Database } from '../db/database';
import { legalData, legalDocuments, type AcceptedLegalTemplate } from '../db/schema';

interface LegalDocumentRow extends LegalDocumentSettings {
  acceptedTemplate: AcceptedLegalTemplate | null;
  acceptedAt: Date | null;
  publishedHash: string | null;
  asOf: string | null;
}

export interface LegalState {
  documents: Record<LegalDocument, LegalDocumentRow>;
  imprintData: ImprintData;
  privacyData: PrivacyData;
  updatedAt: Date | null;
}

interface LegalSettingsWrite {
  documents: Record<LegalDocument, LegalDocumentSettings>;
  imprintData: ImprintData;
  privacyData: PrivacyData;
}

/** Persistence of the legal settings (S-7); `DrizzleLegalStore` in production, in-memory in tests. */
export interface ILegalStore {
  get(): Promise<LegalState>;
  saveSettings(write: LegalSettingsWrite): Promise<void>;
  accept(document: LegalDocument, template: AcceptedLegalTemplate, at: Date): Promise<void>;
  setPublished(document: LegalDocument, hash: string, asOf: string): Promise<void>;
}

export const LEGAL_STORE = Symbol('LEGAL_STORE');

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = ['imprint', 'privacy'];

const emptyDocumentRow = (): LegalDocumentRow => ({
  mode: null,
  url: null,
  acceptedTemplate: null,
  acceptedAt: null,
  publishedHash: null,
  asOf: null,
});

@Injectable()
export class DrizzleLegalStore implements ILegalStore {
  private readonly logger = new Logger('LegalStore');

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async get(): Promise<LegalState> {
    const [docs, [data]] = await Promise.all([this.db.select().from(legalDocuments), this.db.select().from(legalData)]);
    const documents = { imprint: emptyDocumentRow(), privacy: emptyDocumentRow() };
    for (const row of docs) {
      if (row.document !== 'imprint' && row.document !== 'privacy') continue;
      documents[row.document] = {
        mode: legalModeSchema.nullable().catch(null).parse(row.mode),
        // links from S-4 were not limited to http(s)
        url: httpUrlOrNull(row.url),
        acceptedTemplate: row.acceptedTemplate ?? null,
        acceptedAt: row.acceptedAt,
        publishedHash: row.publishedHash,
        asOf: row.asOf,
      };
    }
    return {
      documents,
      imprintData: this.parse('imprint', imprintDataSchema, data?.imprintData, EMPTY_IMPRINT_DATA),
      privacyData: this.parse('privacy', privacyDataSchema, data?.privacyData, EMPTY_PRIVACY_DATA),
      updatedAt: data?.updatedAt ?? null,
    };
  }

  async saveSettings(write: LegalSettingsWrite): Promise<void> {
    const now = new Date();
    await this.db.transaction(async (tx) => {
      for (const document of LEGAL_DOCUMENTS) {
        const { mode, url } = write.documents[document];
        await tx
          .insert(legalDocuments)
          .values({ document, mode, url, updatedAt: now })
          .onDuplicateKeyUpdate({ set: { mode, url, updatedAt: now } });
      }
      const values = { imprintData: write.imprintData, privacyData: write.privacyData, updatedAt: now };
      await tx.insert(legalData).values({ id: 1, ...values }).onDuplicateKeyUpdate({ set: values });
    });
  }

  async accept(document: LegalDocument, template: AcceptedLegalTemplate, at: Date): Promise<void> {
    const set = { acceptedTemplate: template, acceptedAt: at, updatedAt: at };
    await this.db.insert(legalDocuments).values({ document, ...set }).onDuplicateKeyUpdate({ set });
  }

  async setPublished(document: LegalDocument, hash: string, asOf: string): Promise<void> {
    const set = { publishedHash: hash, asOf };
    await this.db.insert(legalDocuments).values({ document, ...set }).onDuplicateKeyUpdate({ set });
  }

  /** Stored JSON is validated on read; a value that no longer fits is replaced by the empty form (logged). */
  private parse<T>(name: string, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, value: unknown, empty: T): T {
    if (value === undefined || value === null) return empty;
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    this.logger.error(`Stored ${name} data does not match the schema – showing an empty form`);
    return empty;
  }
}

/** In-memory store for tests. */
export class InMemoryLegalStore implements ILegalStore {
  state: LegalState = {
    documents: { imprint: emptyDocumentRow(), privacy: emptyDocumentRow() },
    imprintData: EMPTY_IMPRINT_DATA,
    privacyData: EMPTY_PRIVACY_DATA,
    updatedAt: null,
  };

  async get(): Promise<LegalState> {
    return structuredClone(this.state);
  }

  async saveSettings(write: LegalSettingsWrite): Promise<void> {
    for (const d of LEGAL_DOCUMENTS) this.state.documents[d] = { ...this.state.documents[d], ...write.documents[d] };
    this.state.imprintData = structuredClone(write.imprintData);
    this.state.privacyData = structuredClone(write.privacyData);
    this.state.updatedAt = new Date();
  }

  async accept(document: LegalDocument, template: AcceptedLegalTemplate, at: Date): Promise<void> {
    this.state.documents[document] = { ...this.state.documents[document], acceptedTemplate: structuredClone(template), acceptedAt: at };
  }

  async setPublished(document: LegalDocument, hash: string, asOf: string): Promise<void> {
    this.state.documents[document] = { ...this.state.documents[document], publishedHash: hash, asOf };
  }
}
