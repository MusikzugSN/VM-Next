import { germanStateSchema, type GermanState } from '@vm-web/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as z from 'zod';
import { legalDir } from './legal-templates';

const authoritySchema = z.object({ name: z.string().min(1), address: z.string().min(1), website: z.string().min(1) });
export type SupervisoryAuthority = z.infer<typeof authoritySchema>;

const fileSchema = z.object({
  version: z.number().int(),
  date: z.string(),
  authorities: z.record(germanStateSchema, authoritySchema),
});

export type SupervisoryAuthorities = Partial<Record<GermanState, SupervisoryAuthority>>;

/** `supervisory-authorities.json` (S-7). */
export function loadSupervisoryAuthorities(dir = legalDir()): SupervisoryAuthorities {
  return fileSchema.parse(JSON.parse(readFileSync(join(dir, 'supervisory-authorities.json'), 'utf8'))).authorities;
}

/** Entries still marked `TODO` are not verified and block publishing the privacy policy. */
export function isVerified(authority: SupervisoryAuthority | undefined): authority is SupervisoryAuthority {
  return !!authority && ![authority.name, authority.address, authority.website].some((v) => /TODO/i.test(v));
}
