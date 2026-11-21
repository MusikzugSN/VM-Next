import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { PRINT_SERVICE_PORT } from '@vm-web/shared';

/** Settings of the print service (docs/print-service.md). */
export interface ServiceConfig {
  /** The only origin allowed to send jobs, e.g. `https://noten.musikverein.de` (D-4). */
  allowedOrigin: string;
  port: number;
  /** Jobs (`jobs.json`) and their PDFs. */
  dataDir: string;
  /** PDFs larger than this are refused with 413. */
  maxPdfBytes: number;
  /** History and PDFs are kept this long (D-5). */
  retentionDays: number;
}

export const MAX_PDF_BYTES = 200 * 1024 * 1024;
export const RETENTION_DAYS = 30;

interface FileConfig {
  allowedOrigin?: string;
}

/**
 * Reads `$XDG_CONFIG_HOME/vm-web-print/config.json` (`{ "allowedOrigin": "https://…" }`);
 * `VMWEB_PRINT_ORIGIN` overrides it. Throws with a readable message if no origin is set.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, home = homedir()): ServiceConfig {
  const configDir = join(env['XDG_CONFIG_HOME'] || join(home, '.config'), 'vm-web-print');
  const dataDir = join(env['XDG_DATA_HOME'] || join(home, '.local', 'share'), 'vm-web-print');
  let file: FileConfig = {};
  try {
    file = JSON.parse(readFileSync(join(configDir, 'config.json'), 'utf8')) as FileConfig;
  } catch {
    // no file: the environment must provide the origin
  }
  const origin = (env['VMWEB_PRINT_ORIGIN'] || file.allowedOrigin || '').trim();
  if (!origin) {
    throw new Error(
      `Keine VM-Web-Adresse eingetragen. Lege ${join(configDir, 'config.json')} an mit {"allowedOrigin": "https://deine-vm-web-adresse"} oder setze VMWEB_PRINT_ORIGIN.`,
    );
  }
  return { allowedOrigin: normalizeOrigin(origin), port: PRINT_SERVICE_PORT, dataDir, maxPdfBytes: MAX_PDF_BYTES, retentionDays: RETENTION_DAYS };
}

/** `https://Noten.Example.org/` → `https://noten.example.org` (what browsers send as Origin). */
export function normalizeOrigin(value: string): string {
  const url = new URL(value);
  return url.origin;
}
