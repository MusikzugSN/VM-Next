import { Inject, Injectable } from '@nestjs/common';
import type { CreateFieldBody, FieldDefinitionsResponse, UpdateFieldBody } from '@vm-web/shared';
import { asc, eq, sql } from 'drizzle-orm';
import { uuidv7 } from '../common/ids/uuid-v7';
import { ProblemException } from '../common/problem-details/problem.exception';
import { withNameTaken } from '../db/db-errors';
import { fieldDefinitions, fieldOptions, scores } from '../db/schema';
import { pruneValues, type FieldDef } from './custom-fields';
import { ScoresRepository } from './scores.repository';

const WITH_OPTIONS = new Set(['select', 'multiselect']);

/** Custom fields of scores (N-2, N-3, F-13). */
@Injectable()
export class FieldsService {
  constructor(@Inject(ScoresRepository) private readonly repo: ScoresRepository) {}

  async list(): Promise<FieldDefinitionsResponse> {
    return { items: (await this.repo.fields()).map((f) => ({ ...f, position: f.position ?? 0 })) };
  }

  async create(body: CreateFieldBody): Promise<{ id: string }> {
    this.checkOptions(body.type, body.options);
    if (await this.repo.fieldNameTaken(body.name)) throw ProblemException.conflict('name-taken');
    const id = uuidv7();
    await withNameTaken(() =>
      this.repo.db.transaction(async (tx) => {
        const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${fieldDefinitions.position}) + 1, 0)::int` }).from(fieldDefinitions);
        await tx.insert(fieldDefinitions).values({ id, name: body.name, type: body.type, required: body.required, position: next });
        if (body.options.length) {
          await tx.insert(fieldOptions).values(body.options.map((o, position) => ({ id: uuidv7(), fieldId: id, label: o.label, position })));
        }
      }),
    );
    return { id };
  }

  /**
   * Changes name, required flag and options; the type is fixed. Options keep their id,
   * new ones get one, removed ones disappear from all scores.
   */
  async update(fieldId: string, body: UpdateFieldBody): Promise<void> {
    const def = (await this.repo.fields()).find((f) => f.id === fieldId);
    if (!def) throw ProblemException.notFound();
    this.checkOptions(def.type, body.options);
    const known = new Set(def.options.map((o) => o.id));
    const unknown = body.options.map((o, i) => [o, i] as const).filter(([o]) => o.id && !known.has(o.id));
    if (unknown.length) {
      throw ProblemException.validation(unknown.map(([, i]) => ({ path: `/body/options/${i}/id`, code: 'unknown_option' })));
    }
    if (await this.repo.fieldNameTaken(body.name, fieldId)) throw ProblemException.conflict('name-taken');

    await withNameTaken(() =>
      this.repo.db.transaction(async (tx) => {
        await tx.update(fieldDefinitions).set({ name: body.name, required: body.required }).where(eq(fieldDefinitions.id, fieldId));
        const options = body.options.map((o, position) => ({ id: o.id ?? uuidv7(), label: o.label, position }));
        await tx.delete(fieldOptions).where(eq(fieldOptions.fieldId, fieldId));
        if (options.length) await tx.insert(fieldOptions).values(options.map((o) => ({ ...o, fieldId })));

        // remove values of deleted options (N-2)
        const updated: FieldDef = { ...def, name: body.name, required: body.required, options };
        if (WITH_OPTIONS.has(def.type)) {
          const rows = await tx
            .select({ id: scores.id, values: scores.customValues })
            .from(scores)
            .where(sql`jsonb_exists(${scores.customValues}, ${fieldId})`);
          for (const row of rows) {
            const value = pruneValues(updated, row.values[fieldId]);
            if (JSON.stringify(value) === JSON.stringify(row.values[fieldId])) continue;
            const next = { ...row.values };
            if (value === null) delete next[fieldId];
            else next[fieldId] = value;
            await tx.update(scores).set({ customValues: next }).where(eq(scores.id, row.id));
          }
        }
      }),
    );
  }

  /** Deletes the field and its values in all scores. */
  async delete(fieldId: string): Promise<void> {
    await this.repo.db.transaction(async (tx) => {
      const [deleted] = await tx.delete(fieldDefinitions).where(eq(fieldDefinitions.id, fieldId)).returning({ id: fieldDefinitions.id });
      if (!deleted) throw ProblemException.notFound();
      await tx
        .update(scores)
        .set({ customValues: sql`${scores.customValues} - ${fieldId}::text` })
        .where(sql`jsonb_exists(${scores.customValues}, ${fieldId})`);
    });
  }

  /** The list must contain every field exactly once (409 `conflict` otherwise). */
  async reorder(fieldIds: readonly string[]): Promise<void> {
    await this.repo.db.transaction(async (tx) => {
      const current = await tx.select({ id: fieldDefinitions.id }).from(fieldDefinitions).orderBy(asc(fieldDefinitions.position));
      const same = new Set(fieldIds).size === fieldIds.length && fieldIds.length === current.length && current.every((c) => fieldIds.includes(c.id));
      if (!same) throw ProblemException.conflict('conflict', 'Field list incomplete or outdated');
      for (const [position, id] of fieldIds.entries()) {
        await tx.update(fieldDefinitions).set({ position }).where(eq(fieldDefinitions.id, id));
      }
    });
  }

  private checkOptions(type: string, options: readonly unknown[]): void {
    if (!WITH_OPTIONS.has(type) && options.length) {
      throw ProblemException.validation([{ path: '/body/options', code: 'options_not_allowed' }]);
    }
    if (WITH_OPTIONS.has(type) && !options.length) {
      throw ProblemException.validation([{ path: '/body/options', code: 'too_small' }]);
    }
  }
}
