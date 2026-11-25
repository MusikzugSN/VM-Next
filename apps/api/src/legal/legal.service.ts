import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  APP_ROUTES,
  type AcceptLegalTemplateBody,
  type ImprintData,
  type LegalDocument,
  type LegalDocumentStatus,
  type LegalLink,
  type LegalMissingField,
  type LegalModuleKey,
  type LegalPreviewBody,
  type LegalPreviewResponse,
  type LegalSettingsResponse,
  type LegalStatusResponse,
  type LegalTemplateState,
  type PrivacyData,
  type PublicLegalDocumentResponse,
  type UpdateLegalSettingsBody,
} from '@vm-web/shared';
import { createHash } from 'node:crypto';
import { ProblemException } from '../common/problem-details/problem.exception';
import { todayIn } from '../common/time/today';
import { AppConfig } from '../config/app-config.service';
import type { AcceptedLegalTemplate } from '../db/schema';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import { documentMissing, imprintMissing, privacyMissing, privacyWarnings } from './legal-completeness';
import { buildLegalContext } from './legal-context';
import { markdownToHtml } from './legal-markdown';
import { activeModules, composePrivacyTemplate } from './legal-modules';
import { escapeMarkdownInline, parseTemplate, renderTemplate, TemplateError } from './legal-renderer';
import { LEGAL_TEMPLATES, type ILegalTemplateSource } from './legal-template-source';
import { LEGAL_DOCUMENTS, LEGAL_STORE, type ILegalStore, type LegalState } from './legal.store';

interface RenderInput {
  document: LegalDocument;
  template: AcceptedLegalTemplate;
  imprint: ImprintData;
  privacy: PrivacyData;
  active: readonly LegalModuleKey[];
  asOf: string;
  preview: boolean;
}

/** Impressum & Datenschutzerklärung (S-7). */
@Injectable()
export class LegalService {
  private readonly logger = new Logger('Legal');

  constructor(
    @Inject(LEGAL_STORE) private readonly store: ILegalStore,
    @Inject(LEGAL_TEMPLATES) private readonly templates: ILegalTemplateSource,
    @Inject(ClubSettingsRepository) private readonly club: ClubSettingsRepository,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  // --- public -------------------------------------------------------------------------------

  /** Public page; incomplete or unconfigured documents are never published. */
  async publicDocument(document: LegalDocument): Promise<PublicLegalDocumentResponse> {
    const state = await this.store.get();
    const row = state.documents[document];
    if (row.mode === 'link') return row.url ? { mode: 'link', url: row.url } : { mode: 'unavailable' };
    if (row.mode !== 'generated' || !row.acceptedTemplate) return { mode: 'unavailable' };
    const active = await this.activeModules();
    if (this.missing(document, state).length) return { mode: 'unavailable' };

    const asOf = await this.ensureAsOf(document, state, active);
    let rendered: { html: string; missing: string[] };
    try {
      rendered = this.render({
        document,
        template: row.acceptedTemplate,
        imprint: state.imprintData,
        privacy: state.privacyData,
        active,
        asOf,
        preview: false,
      });
    } catch (error) {
      // a stored template that no longer fits the data model must not take the page down
      if (!(error instanceof TemplateError)) throw error;
      this.logger.error(`${document}: accepted template ${row.acceptedTemplate.version} cannot be rendered: ${error.message}`);
      return { mode: 'unavailable' };
    }
    const { html, missing } = rendered;
    if (missing.length) {
      // completeness check and template disagree – never publish a document with gaps
      this.logger.error(`${document}: placeholders without value: ${missing.join(', ')}`);
      return { mode: 'unavailable' };
    }
    return { mode: 'generated', html, asOf, templateVersion: row.acceptedTemplate.version };
  }

  /** Where login page, footer and user menu link to. */
  async links(): Promise<Record<LegalDocument, LegalLink>> {
    const state = await this.store.get();
    const link = (document: LegalDocument, internal: string): LegalLink => {
      const row = state.documents[document];
      return row.mode === 'link' && row.url ? { kind: 'external', href: row.url } : { kind: 'internal', href: internal };
    };
    return { imprint: link('imprint', APP_ROUTES.imprint), privacy: link('privacy', APP_ROUTES.privacy) };
  }

  // --- configuration ------------------------------------------------------------------------

  async settings(): Promise<LegalSettingsResponse> {
    const state = await this.store.get();
    const active = await this.activeModules();
    const doc = (document: LegalDocument) => {
      const row = state.documents[document];
      const missingFields = this.missing(document, state);
      return {
        mode: row.mode,
        url: row.url,
        status: this.statusOf(document, state, missingFields),
        missingFields,
        template: this.templateState(document, state),
      };
    };
    return {
      imprint: doc('imprint'),
      privacy: doc('privacy'),
      imprintData: state.imprintData,
      privacyData: state.privacyData,
      activeModules: active,
      warnings: privacyWarnings(state.documents.privacy, state.privacyData),
      updatedAt: state.updatedAt?.toISOString() ?? null,
    };
  }

  async status(): Promise<LegalStatusResponse> {
    const state = await this.store.get();
    return {
      imprint: this.statusOf('imprint', state, this.missing('imprint', state)),
      privacy: this.statusOf('privacy', state, this.missing('privacy', state)),
      templateUpdateAvailable: LEGAL_DOCUMENTS.some(
        (d) => state.documents[d].mode === 'generated' && this.templateState(d, state).updateAvailable,
      ),
    };
  }

  /** Saves the whole form; the first switch to `generated` accepts the shipped template. */
  async update(body: UpdateLegalSettingsBody): Promise<void> {
    await this.store.saveSettings({
      documents: { imprint: body.imprint, privacy: body.privacy },
      imprintData: body.imprintData,
      privacyData: body.privacyData,
    });
    const state = await this.store.get();
    for (const document of LEGAL_DOCUMENTS) {
      if (state.documents[document].mode === 'generated' && !state.documents[document].acceptedTemplate) {
        await this.store.accept(document, this.templates.shipped(document), new Date());
      }
    }
    await this.refreshAsOf();
  }

  /** Renders unsaved data; `available` previews the shipped template before accepting it. */
  async preview(body: LegalPreviewBody): Promise<LegalPreviewResponse> {
    const state = await this.store.get();
    const accepted = state.documents[body.document].acceptedTemplate;
    const template = body.templateVersion === 'available' || !accepted ? this.templates.shipped(body.document) : accepted;
    const active = await this.activeModules();
    const { html } = this.render({
      document: body.document,
      template,
      imprint: body.imprintData,
      privacy: body.privacyData,
      active,
      asOf: this.today(),
      preview: true,
    });
    const missingFields = this.generatedMissing(body.document, body.imprintData, body.privacyData);
    return { html, templateVersion: template.version, templateDate: template.date, missingFields };
  }

  async acceptTemplate(body: AcceptLegalTemplateBody): Promise<void> {
    const shipped = this.templates.shipped(body.document);
    if (body.version !== shipped.version) throw ProblemException.conflict('conflict', `Available version is ${shipped.version}`);
    const state = await this.store.get();
    if (state.documents[body.document].acceptedTemplate?.version === shipped.version) {
      throw ProblemException.conflict('conflict', 'Version already accepted');
    }
    await this.store.accept(body.document, shipped, new Date());
    await this.refreshAsOf();
  }

  // --- internals ----------------------------------------------------------------------------

  private async activeModules(): Promise<LegalModuleKey[]> {
    const club = await this.club.get();
    return activeModules({ printServiceConfigured: !!club.publicBaseUrl });
  }

  private generatedMissing(document: LegalDocument, imprint: ImprintData, privacy: PrivacyData): LegalMissingField[] {
    return document === 'imprint' ? imprintMissing(imprint) : privacyMissing(imprint, privacy, this.templates.authorities());
  }

  private missing(document: LegalDocument, state: LegalState): LegalMissingField[] {
    return documentMissing(state.documents[document], () => this.generatedMissing(document, state.imprintData, state.privacyData));
  }

  private statusOf(document: LegalDocument, state: LegalState, missing: readonly LegalMissingField[]): LegalDocumentStatus {
    const row = state.documents[document];
    if (!row.mode) return 'not-configured';
    if (missing.length) return 'incomplete';
    return row.mode === 'link' || row.acceptedTemplate ? 'published' : 'incomplete';
  }

  private templateState(document: LegalDocument, state: LegalState): LegalTemplateState {
    const shipped = this.templates.shipped(document);
    const row = state.documents[document];
    const acceptedVersion = row.acceptedTemplate?.version ?? null;
    return {
      acceptedVersion,
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      availableVersion: shipped.version,
      availableDate: shipped.date,
      updateAvailable: acceptedVersion !== null && shipped.version > acceptedVersion,
    };
  }

  private render(input: RenderInput): { html: string; missing: string[] } {
    const source =
      input.document === 'privacy' ? composePrivacyTemplate(input.template, input.active) : input.template.main;
    const context = buildLegalContext({
      imprint: input.imprint,
      privacy: input.privacy,
      authority: input.privacy.state ? this.templates.authorities()[input.privacy.state] : undefined,
      activeModules: input.active,
      session: { idleDays: this.config.get('SESSION_IDLE_TTL_DAYS'), maxDays: this.config.get('SESSION_ABSOLUTE_TTL_DAYS') },
      asOf: input.asOf,
      templateVersion: input.template.version,
    });
    const { markdown, missing } = renderTemplate(parseTemplate(source), context, {
      missing: input.preview ? (path) => `**${escapeMarkdownInline(`[fehlt: ${path}]`)}**` : undefined,
    });
    return { html: markdownToHtml(markdown), missing };
  }

  /**
   * „Stand“ moves to today whenever anything that changes the published text changes: data,
   * accepted template, active modules, authority list or session durations.
   */
  private async ensureAsOf(document: LegalDocument, state: LegalState, active: readonly LegalModuleKey[]): Promise<string> {
    const row = state.documents[document];
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          template: row.acceptedTemplate,
          imprint: state.imprintData,
          privacy: document === 'privacy' ? state.privacyData : null,
          authority: document === 'privacy' && state.privacyData.state ? this.templates.authorities()[state.privacyData.state] : null,
          active: document === 'privacy' ? active : null,
          session: document === 'privacy' ? [this.config.get('SESSION_IDLE_TTL_DAYS'), this.config.get('SESSION_ABSOLUTE_TTL_DAYS')] : null,
        }),
      )
      .digest('hex');
    if (row.publishedHash === hash && row.asOf) return row.asOf;
    const asOf = this.today();
    await this.store.setPublished(document, hash, asOf);
    return asOf;
  }

  /** After a change: move „Stand“ of every document that is published now. */
  private async refreshAsOf(): Promise<void> {
    const state = await this.store.get();
    const active = await this.activeModules();
    for (const document of LEGAL_DOCUMENTS) {
      const row = state.documents[document];
      if (row.mode === 'generated' && row.acceptedTemplate && !this.missing(document, state).length) {
        await this.ensureAsOf(document, state, active);
      }
    }
  }

  private today(): string {
    return todayIn(this.config.get('APP_TIMEZONE'));
  }
}
