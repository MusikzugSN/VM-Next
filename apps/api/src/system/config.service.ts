import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  API_PREFIX,
  permissionScope,
  type ConfigDefaultOptionsResponse,
  type ConfigResponse,
  type ConfigWarning,
  type Permission,
  type UpdateClubBody,
  type UpdateDefaultsBody,
  type UpdatePrintBody,
} from '@vm-web/shared';
import { readFile, rm } from 'node:fs/promises';
import { uploadTempPath } from '../common/files/upload-temp';
import { uuidv7 } from '../common/ids/uuid-v7';
import { ProblemException } from '../common/problem-details/problem.exception';
import { httpUrlOrNull } from '../common/url';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import { FILE_STORAGE, type IFileStorage } from '../storage/file-storage';
import { ConfigRepository, type ClubSettingsUpdate } from './config.repository';

const BOM = new RegExp('^' + String.fromCharCode(0xfeff));

/** Supported logo formats, detected from the first bytes (S-4). */
export function detectImage(bytes: Buffer): { mime: string; ext: string } | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  const head = bytes.subarray(0, 1024).toString('utf8').replace(BOM, '').trimStart();
  if (isSvgHead(head)) return { mime: 'image/svg+xml', ext: 'svg' };
  return null;
}

/**
 * `<svg` after an optional XML declaration, comments and an SVG doctype.
 * Scanned step by step instead of one regex, so the time stays linear in the input (no ReDoS).
 */
function isSvgHead(head: string): boolean {
  let rest = head;
  const xmlDecl = /^<\?xml[^>]*>/i.exec(rest);
  if (xmlDecl) rest = rest.slice(xmlDecl[0].length).trimStart();
  while (rest.startsWith('<!--')) {
    const end = rest.indexOf('-->', 4);
    if (end < 0) return false;
    rest = rest.slice(end + 3).trimStart();
  }
  const doctype = /^<!DOCTYPE svg[^>]*>/i.exec(rest);
  if (doctype) rest = rest.slice(doctype[0].length).trimStart();
  return /^<svg[\s>]/i.test(rest);
}

/** Club configuration (S-4, A-2, A-3, D-2, D-4, B-1). OIDC settings stay in the environment. */
@Injectable()
export class ConfigService {
  private readonly logger = new Logger('Config');

  constructor(
    @Inject(ConfigRepository) private readonly repo: ConfigRepository,
    @Inject(ClubSettingsRepository) private readonly settings: ClubSettingsRepository,
    @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
  ) {}

  async get(): Promise<ConfigResponse> {
    const s = await this.settings.get();
    const ensemble = s.defaultEnsembleId ? await this.repo.ensembleRef(s.defaultEnsembleId) : undefined;
    const role = s.defaultRoleId ? await this.repo.roleRef(s.defaultRoleId) : undefined;
    const warnings: ConfigWarning[] = [];
    if (s.defaultRoleId && (await this.hasClubPermissions([s.defaultRoleId])).has(s.defaultRoleId)) warnings.push('default-role-has-club-permissions');
    return {
      club: {
        clubName: s.clubName,
        loginAutoRedirect: s.loginAutoRedirect,
        logoUrl: s.logoFileKey ? `${API_PREFIX}/auth/branding/logo` : null,
        loginBanner: s.loginBanner,
      },
      defaults: { defaultEnsemble: ensemble ?? null, defaultRole: role ?? null },
      print: { browserPrintPageLimit: s.browserPrintPageLimit, publicBaseUrl: httpUrlOrNull(s.publicBaseUrl) },
      warnings,
    };
  }

  async defaultOptions(): Promise<ConfigDefaultOptionsResponse> {
    const [ensembleRows, roleRows] = await Promise.all([this.repo.activeEnsembleOptions(), this.repo.roleOptions()]);
    const club = await this.hasClubPermissions(roleRows.map((r) => r.id));
    return { ensembles: ensembleRows, roles: roleRows.map((r) => ({ ...r, hasClubPermissions: club.has(r.id) })) };
  }

  async updateClub(body: UpdateClubBody): Promise<void> {
    await this.update({
      clubName: body.clubName,
      loginBanner: body.loginBanner || null,
      loginAutoRedirect: body.loginAutoRedirect,
    });
  }

  async updateDefaults(body: UpdateDefaultsBody): Promise<void> {
    await this.repo.updateDefaults(body.defaultEnsembleId, body.defaultRoleId, ({ ensemble, roleExists }) => {
      if (body.defaultEnsembleId && !ensemble) throw ProblemException.notFound('Unknown ensemble');
      if (ensemble?.archivedAt) throw ProblemException.validation([{ path: '/body/defaultEnsembleId', code: 'archived' }]);
      if (body.defaultRoleId && !roleExists) throw ProblemException.notFound('Unknown role');
    });
  }

  async updatePrint(body: UpdatePrintBody): Promise<void> {
    await this.update({ browserPrintPageLimit: body.browserPrintPageLimit, publicBaseUrl: body.publicBaseUrl });
  }

  /** Replaces the logo; PNG, JPEG, WebP or SVG detected from the content, max. 2 MB (multer limit). */
  async uploadLogo(file: { path: string } | undefined): Promise<void> {
    if (!file) throw ProblemException.validation([{ path: '/file', code: 'required' }]);
    const path = uploadTempPath(file.path);
    try {
      const bytes = await readFile(path);
      const image = detectImage(bytes);
      if (!image) throw new ProblemException(415, 'unsupported-media-type', 'PNG, JPEG, WebP or SVG only', [{ path: '/file', code: 'not_image' }]);
      const key = `branding/logo-${uuidv7()}.${image.ext}`;
      await this.storage.write(key, bytes);
      const old = (await this.settings.get()).logoFileKey;
      await this.update({ logoFileKey: key, logoMime: image.mime });
      if (old) await this.storage.delete(old).catch((e: unknown) => this.logger.warn(`Could not delete old logo: ${String(e)}`));
    } finally {
      await rm(path, { force: true });
    }
  }

  async removeLogo(): Promise<void> {
    const old = (await this.settings.get()).logoFileKey;
    await this.update({ logoFileKey: null, logoMime: null });
    if (old) await this.storage.delete(old).catch(() => undefined);
  }

  private update(set: ClubSettingsUpdate): Promise<void> {
    return this.repo.update(set);
  }

  private async hasClubPermissions(roleIds: readonly string[]): Promise<Set<string>> {
    const rows = await this.repo.permissionsOf(roleIds);
    return new Set(rows.filter((r) => permissionScope(r.permission as Permission) === 'club').map((r) => r.roleId));
  }
}
