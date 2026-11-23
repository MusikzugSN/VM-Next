import { asc, eq, inArray, sql } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { uuidv7 } from '../common/ids/uuid-v7';
import type { Database } from '../db/database';
import { instruments, voices, voiceSubstitutes } from '../db/schema';
import { nextPosition } from '../db/table-helpers';

/** Format of `defaults/lineup.default.json` (N-8). Voices with `lineup: false` exist but are not part of the lineup. */
export const lineupTemplateSchema = z
  .object({
    version: z.number().int().positive(),
    name: z.string().min(1),
    instruments: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(100),
          voices: z.array(z.object({ name: z.string().trim().min(1).max(100), lineup: z.boolean().default(true) })).min(1),
        }),
      )
      .min(1),
    substitutes: z.record(z.string(), z.array(z.string())).default({}),
  })
  .superRefine((t, ctx) => {
    const names = t.instruments.flatMap((i) => i.voices.map((v) => v.name.toLowerCase()));
    const known = new Set(names);
    if (known.size !== names.length) ctx.addIssue({ code: 'custom', message: 'duplicate voice names' });
    for (const [voice, subs] of Object.entries(t.substitutes)) {
      for (const name of [voice, ...subs]) {
        if (!known.has(name.toLowerCase())) ctx.addIssue({ code: 'custom', message: `unknown voice "${name}" in substitutes` });
      }
    }
  });
export type LineupTemplate = z.infer<typeof lineupTemplateSchema>;

export async function loadLineupTemplate(path: string): Promise<LineupTemplate> {
  return lineupTemplateSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Creates missing instruments and voices of the template (matched case-insensitively by name) and
 * fills substitutes of voices that have none yet. Existing data is never changed.
 * Returns the voice ids of the lineup in template order – used to (re)apply the lineup to an ensemble.
 */
export async function importLineupTemplate(
  tx: Tx | Database,
  template: LineupTemplate,
): Promise<{ lineupVoiceIds: string[]; createdInstruments: number; createdVoices: number }> {
  let createdInstruments = 0;
  let createdVoices = 0;
  const voiceIdByName = new Map<string, string>();
  const lineupVoiceIds: string[] = [];

  let instrumentPosition = await nextPosition(tx, instruments.position);

  for (const inst of template.instruments) {
    const [existing] = await tx.select({ id: instruments.id }).from(instruments).where(sql`lower(${instruments.name}) = lower(${inst.name})`);
    let instrumentId = existing?.id;
    if (!instrumentId) {
      instrumentId = uuidv7();
      await tx.insert(instruments).values({ id: instrumentId, name: inst.name, position: instrumentPosition++ });
      createdInstruments++;
    }
    const existingVoices = await tx.select({ position: voices.position }).from(voices).where(eq(voices.instrumentId, instrumentId)).orderBy(asc(voices.position));
    let voicePosition = (existingVoices.at(-1)?.position ?? -1) + 1;

    for (const v of inst.voices) {
      const [found] = await tx.select({ id: voices.id }).from(voices).where(sql`lower(${voices.name}) = lower(${v.name})`);
      let voiceId = found?.id;
      if (!voiceId) {
        voiceId = uuidv7();
        await tx.insert(voices).values({ id: voiceId, instrumentId, name: v.name, position: voicePosition++ });
        createdVoices++;
      }
      voiceIdByName.set(v.name.toLowerCase(), voiceId);
      if (v.lineup) lineupVoiceIds.push(voiceId);
    }
  }

  const withSubstitutes = new Set(
    (await tx.selectDistinct({ id: voiceSubstitutes.voiceId }).from(voiceSubstitutes).where(inArray(voiceSubstitutes.voiceId, [...voiceIdByName.values()]))).map((r) => r.id),
  );
  for (const [voice, subs] of Object.entries(template.substitutes)) {
    const voiceId = voiceIdByName.get(voice.toLowerCase());
    if (!voiceId || withSubstitutes.has(voiceId) || !subs.length) continue;
    await tx.insert(voiceSubstitutes).values(
      subs.map((name, position) => ({ voiceId, substituteVoiceId: voiceIdByName.get(name.toLowerCase()) as string, position })),
    );
  }

  return { lineupVoiceIds, createdInstruments, createdVoices };
}
