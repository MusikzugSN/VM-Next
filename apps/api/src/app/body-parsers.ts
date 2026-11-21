import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_PREFIX, API_ROUTES } from '@vm-web/shared';
import type { IncomingMessage } from 'node:http';

/** Default JSON limit (Nest/Express default). */
export const JSON_BODY_LIMIT = '100kb';
/** The CSV import sends up to 5000 rows of raw cells (N-19). */
export const IMPORT_BODY_LIMIT = '10mb';

const IMPORT_PATH = `${API_PREFIX}/${API_ROUTES.scores.base}/${API_ROUTES.scores.importScores.path}`;

function isJson(req: IncomingMessage): boolean {
  return /^application\/(.+\+)?json\b/i.test(req.headers['content-type'] ?? '');
}

function isImport(req: IncomingMessage): boolean {
  return (req.url ?? '').split('?')[0] === IMPORT_PATH;
}

/**
 * Body parsers: a larger JSON limit only for the CSV import, 100 kB everywhere else.
 * Requires the app to be created with `bodyParser: false`; a parser skips bodies that are already parsed.
 */
export function useBodyParsers(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: IMPORT_BODY_LIMIT, type: (req: IncomingMessage) => isJson(req) && isImport(req) });
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: JSON_BODY_LIMIT, extended: true });
}
