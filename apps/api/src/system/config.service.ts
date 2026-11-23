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
import { eq } from 'drizzle-orm';
import { readFile, rm } from 'node:fs/promises';
import { activeEnsembleOptions } from '../common/ensemble-tree';
import { uuidv7 } from '../common/ids/uuid-v7';
import { ProblemException } from '../common/problem-details/problem.exception';
import { httpUrlOrNull } from '../common/url';
import { DATABASE, type Database } from '../db/database';
import { clubSettings, ensembles, rolePermissions, roles } from '../db/schema';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import { FILE_STORAGE, type IFileStorage } from '../storage/file-storage';
import { assertActiveEnsemble, assertRoleExists, roleOptions } from '../library/library-helpers';

const BOM = new RegExp('^' + String.fromCharCode(0xfeff));

/** Supported logo formats, detected from the first bytes (S-4). */
export function detectImage(bytes: Buffer): { mime: string; ext: string } | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  const head = bytes.subarray(0, 1024).toString('utf8').replace(BOM, '').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return { mime: 'image/svg+xml', ext: 'svg' };
  return null;
}

/** Club configuration (S-4, A-2, A-3, D-2, D-4, B-1). OIDC settings stay in the environment. */
@Injectable()
export class ConfigService {
  private readonly logger = new Logger('Config');

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ClubSettingsRepository) private readonly settings: ClubSettingsRepository,
    @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
  ) {}

  async get(): Promise<ConfigResponse> {
    const s = await this.settings.get();
    const [ensemble] = s.defaultEnsembleId
      ? await this.db.select({ id: ensembles.id, name: ensembles.name }).from(ensembles).where(eq(ensembles.id, s.defaultEnsembleId))
      : [];
    const [role] = s.defaultRoleId ? await this.db.select({ id: roles.id, name: roles.name }).from(roles).where(eq(roles.id, s.defaultRoleId)) : [];
    const warnings: ConfigWarning[] = [];
    if (s.defaultRoleId && (await this.hasClubPermissions([s.defaultRoleId])).has(s.defaultRoleId)) warnings.push('default-role-has-club-permissions');
    return {
      club: {
        clubName: s.clubName,
        imprintUrl: httpUrlOrNull(s.imprintUrl),
        privacyUrl: httpUrlOrNull(s.privacyUrl),
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
    const [ensembleRows, roleRows] = await Promise.all([
      activeEnsembleOptions(this.db),
      roleOptions(this.db),
    ]);
    const club = await this.hasClubPermissions(roleRows.map((r) => r.id));
    return { ensembles: ensembleRows, roles: roleRows.map((r) => ({ ...r, hasClubPermissions: club.has(r.id) })) };
  }

  async updateClub(body: UpdateClubBody): Promise<void> {
    await this.update({
      clubName: body.clubName,
      imprintUrl: body.imprintUrl,
      privacyUrl: body.privacyUrl,
      loginBanner: body.loginBanner || null,
      loginAutoRedirect: body.loginAutoRedirect,
    });
  }

  /** Defaults for new accounts (A-3); archived ensembles are refused. */
  async updateDefaults(body: UpdateDefaultsBody): Promise<void> {
    if (body.defaultEnsembleId) await assertActiveEnsemble(this.db, body.defaultEnsembleId, '/body/defaultEnsembleId');
    if (body.defaultRoleId) await assertRoleExists(this.db, body.defaultRoleId);
    await this.update({ defaultEnsembleId: body.defaultEnsembleId, defaultRoleId: body.defaultRoleId });
  }

  async updatePrint(body: UpdatePrintBody): Promise<void> {
    await this.update({ browserPrintPageLimit: body.browserPrintPageLimit, publicBaseUrl: body.publicBaseUrl });
  }

  /** Replaces the logo; PNG, JPEG, WebP or SVG detected from the content, max. 2 MB (multer limit). */
  async uploadLogo(file: { path: string } | undefined): Promise<void> {
    if (!file) throw ProblemException.validation([{ path: '/file', code: 'required' }]);
    try {
      const bytes = await readFile(file.path);
      const image = detectImage(bytes);
      if (!image) throw new ProblemException(415, 'unsupported-media-type', 'PNG, JPEG, WebP or SVG only', [{ path: '/file', code: 'not_image' }]);
      const key = `branding/logo-${uuidv7()}.${image.ext}`;
      await this.storage.write(key, bytes);
      const old = (await this.settings.get()).logoFileKey;
      await this.update({ logoFileKey: key, logoMime: image.mime });
      if (old) await this.storage.delete(old).catch((e: unknown) => this.logger.warn(`Could not delete old logo: ${String(e)}`));
    } finally {
      await rm(file.path, { force: true });
    }
  }

  async removeLogo(): Promise<void> {
    const old = (await this.settings.get()).logoFileKey;
    await this.update({ logoFileKey: null, logoMime: null });
    if (old) await this.storage.delete(old).catch(() => undefined);
  }

  private async update(set: Partial<typeof clubSettings.$inferInsert>): Promise<void> {
    await this.db.update(clubSettings).set({ ...set, updatedAt: new Date() }).where(eq(clubSettings.id, 1));
  }

  private async hasClubPermissions(roleIds: readonly string[]): Promise<Set<string>> {
    if (!roleIds.length) return new Set();
    const rows = await this.db.select().from(rolePermissions);
    return new Set(rows.filter((r) => roleIds.includes(r.roleId) && permissionScope(r.permission as Permission) === 'club').map((r) => r.roleId));
  }
}
