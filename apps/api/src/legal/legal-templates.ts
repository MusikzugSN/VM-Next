import { legalModuleKeySchema, type LegalDocument, type LegalModuleKey } from '@vm-web/shared';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AcceptedLegalTemplate } from '../db/schema';
import { defaultsDir } from '../seed/defaults';

const BOM = new RegExp('^' + String.fromCharCode(0xfeff));

/** Slot in `privacy.de.md` for the sections of the active modules. */
export const MODULES_SLOT = '{{> modules}}';

interface TemplateFile {
  document: LegalDocument;
  module: LegalModuleKey | null;
  version: number;
  date: string;
  body: string;
}

/** Splits front matter (`key: value` lines between `---`) from the body. */
export function parseTemplateFile(source: string, fileName: string): TemplateFile {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source.replace(BOM, ''));
  if (!match) throw new Error(`${fileName}: front matter missing`);
  const meta = Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => /^(\w+):\s*(.*?)\s*$/.exec(line))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => [m[1], m[2]]),
  );
  const version = Number(meta['version']);
  if (!Number.isInteger(version) || version < 1) throw new Error(`${fileName}: version must be a positive integer`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta['date'] ?? '')) throw new Error(`${fileName}: date must be YYYY-MM-DD`);
  if (meta['document'] !== 'imprint' && meta['document'] !== 'privacy') throw new Error(`${fileName}: document must be imprint or privacy`);
  const module = meta['module'] ? legalModuleKeySchema.parse(meta['module']) : null;
  return { document: meta['document'], module, version, date: meta['date'], body: match[2].replace(/\r\n/g, '\n') };
}

export const legalDir = () => join(defaultsDir(), 'legal');

const FILE_NAMES: Record<LegalDocument, string> = { imprint: 'imprint.de.md', privacy: 'privacy.de.md' };
const MODULE_FILES: readonly LegalModuleKey[] = ['library', 'print-service', 'members', 'notifications'];

/** The template shipped with this release, in the shape that is stored when accepted. */
export function loadShippedTemplate(document: LegalDocument, dir = legalDir()): AcceptedLegalTemplate {
  const read = (name: string) => parseTemplateFile(readFileSync(join(dir, name), 'utf8'), name);
  const main = read(FILE_NAMES[document]);
  if (main.document !== document || main.module) throw new Error(`${FILE_NAMES[document]}: wrong front matter`);
  const modules: Record<string, string> = {};
  if (document === 'privacy') {
    if (!main.body.includes(MODULES_SLOT)) throw new Error(`privacy.de.md: ${MODULES_SLOT} missing`);
    for (const key of MODULE_FILES) {
      const name = `privacy.${key}.de.md`;
      const file = read(name);
      if (file.document !== 'privacy' || file.module !== key) throw new Error(`${name}: wrong front matter`);
      modules[key] = file.body;
    }
  }
  return { version: main.version, date: main.date, main: main.body, modules };
}

/** Content hash of a template set, compared with `versions.lock.json` in a test. */
export function templateHash(template: AcceptedLegalTemplate): string {
  const parts = [template.main, ...Object.keys(template.modules).sort().map((k) => `${k}\n${template.modules[k]}`)];
  return createHash('sha256').update(parts.join('\n\u0000\n')).digest('hex');
}
