import { Injectable } from '@nestjs/common';
import type { LegalDocument } from '@vm-web/shared';
import type { AcceptedLegalTemplate } from '../db/schema';
import { loadShippedTemplate } from './legal-templates';
import { loadSupervisoryAuthorities, type SupervisoryAuthorities } from './supervisory-authorities';

/** Templates and authority list shipped with this release (S-7). Replaced in tests to simulate an update. */
export interface ILegalTemplateSource {
  shipped(document: LegalDocument): AcceptedLegalTemplate;
  authorities(): SupervisoryAuthorities;
}

export const LEGAL_TEMPLATES = Symbol('LEGAL_TEMPLATES');

/** Reads `defaults/legal` once; the files do not change while the server runs. */
@Injectable()
export class FileLegalTemplateSource implements ILegalTemplateSource {
  private readonly cache = new Map<LegalDocument, AcceptedLegalTemplate>();
  private authorityCache: SupervisoryAuthorities | undefined;

  shipped(document: LegalDocument): AcceptedLegalTemplate {
    let template = this.cache.get(document);
    if (!template) {
      template = loadShippedTemplate(document);
      this.cache.set(document, template);
    }
    return template;
  }

  authorities(): SupervisoryAuthorities {
    this.authorityCache ??= loadSupervisoryAuthorities();
    return this.authorityCache;
  }
}
