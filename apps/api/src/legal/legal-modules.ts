import type { LegalModuleKey } from '@vm-web/shared';
import type { AcceptedLegalTemplate } from '../db/schema';
import { MODULES_SLOT } from './legal-templates';

/** What decides whether a module is active in this installation. */
export interface LegalModuleState {
  /** A VM-Web address for the print service is configured (D-4); without it the print service accepts no jobs. */
  printServiceConfigured: boolean;
}

/**
 * A part of VM-Web that contributes a section to the privacy policy (S-7).
 * New features register here and ship `privacy.<key>.de.md`.
 */
export interface LegalModule {
  key: LegalModuleKey;
  /** `base` is the frame (`privacy.de.md`) and has no section of its own. */
  hasSection: boolean;
  isActive(state: LegalModuleState): boolean;
}

/** Registry in the order of the privacy policy. */
export const LEGAL_MODULES: readonly LegalModule[] = [
  { key: 'base', hasSection: false, isActive: () => true },
  { key: 'library', hasSection: true, isActive: () => true },
  { key: 'print-service', hasSection: true, isActive: (s) => s.printServiceConfigured },
  // prepared, filled when member management and e-mail notifications exist
  { key: 'members', hasSection: true, isActive: () => false },
  { key: 'notifications', hasSection: true, isActive: () => false },
];

export function activeModules(state: LegalModuleState): LegalModuleKey[] {
  return LEGAL_MODULES.filter((m) => m.isActive(state)).map((m) => m.key);
}

/** Puts the sections of the active modules into the privacy template at `{{> modules}}`. */
export function composePrivacyTemplate(template: AcceptedLegalTemplate, active: readonly LegalModuleKey[]): string {
  const sections = LEGAL_MODULES.filter((m) => m.hasSection && active.includes(m.key))
    .map((m) => (template.modules[m.key] ?? '').trim())
    .filter(Boolean)
    .map((s) => `${s}\n\n`)
    .join('');
  return template.main.replace(MODULES_SLOT, sections);
}
