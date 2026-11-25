import { Inject, Injectable } from '@nestjs/common';
import type { EnsembleOption, EventDetailsResponse, EventListItem, EventScoreCandidatesResponse, SetlistEntry } from '@vm-web/shared';
import { and, asc, desc, eq, gte, inArray, like, lt, sql } from 'drizzle-orm';
import { uuidv7 } from '../common/ids/uuid-v7';
import { activeEnsembleOptions } from '../common/ensemble-tree';
import type { CursorKey } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { likePattern } from '../common/sql';
import { DATABASE, type Database } from '../db/database';
import { ensembles, events, scores, setlistEntries } from '../db/schema';
import { replaceRows } from '../db/table-helpers';
import { scoreCandidatePage } from '../library/library-helpers';

export interface EventListFilter {
  ensembleIds: string[];
  upcoming: boolean;
  today: string;
  q?: string;
  cursor?: CursorKey;
  limit: number;
}

export interface NewEvent {
  ensembleId: string;
  name: string;
  date: string;
  showInMyArea: boolean;
}

export type EventChanges = Partial<Pick<typeof events.$inferInsert, 'name' | 'date' | 'showInMyArea'>>;

const scoreCount = sql<number>`(select count(*) from setlist_entries x where x.event_id = ${events.id})`;

@Injectable()
export class EventsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async ensembleIdOf(eventId: string): Promise<string | null> {
    const [row] = await this.db.select({ ensembleId: events.ensembleId }).from(events).where(eq(events.id, eventId));
    return row?.ensembleId ?? null;
  }

  activeEnsembleOptions(ids: readonly string[]): Promise<EnsembleOption[]> {
    return activeEnsembleOptions(this.db, ids);
  }

  list(filter: EventListFilter): Promise<EventListItem[]> {
    const { upcoming, cursor } = filter;
    return this.db
      .select({
        id: events.id,
        name: events.name,
        date: events.date,
        ensemble: { id: ensembles.id, name: ensembles.name },
        showInMyArea: events.showInMyArea,
        scoreCount,
      })
      .from(events)
      .innerJoin(ensembles, eq(ensembles.id, events.ensembleId))
      .where(
        and(
          inArray(events.ensembleId, filter.ensembleIds),
          upcoming ? gte(events.date, filter.today) : lt(events.date, filter.today),
          filter.q ? like(events.name, likePattern(filter.q)) : undefined,
          cursor
            ? upcoming
              ? sql`(${events.date}, ${events.id}) > (${cursor[0]}, ${cursor[1]})`
              : sql`(${events.date}, ${events.id}) < (${cursor[0]}, ${cursor[1]})`
            : undefined,
        ),
      )
      .orderBy(...(upcoming ? [asc(events.date), asc(events.id)] : [desc(events.date), desc(events.id)]))
      .limit(filter.limit + 1);
  }

  async details(eventId: string): Promise<EventDetailsResponse | undefined> {
    const [row] = await this.db
      .select({
        id: events.id,
        name: events.name,
        date: events.date,
        ensemble: { id: ensembles.id, name: ensembles.name },
        showInMyArea: events.showInMyArea,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .innerJoin(ensembles, eq(ensembles.id, events.ensembleId))
      .where(eq(events.id, eventId));
    return row && { ...row, updatedAt: row.updatedAt.toISOString() };
  }

  setlist(eventId: string, cursor: CursorKey | undefined, limit: number): Promise<SetlistEntry[]> {
    return this.db
      .select({ position: setlistEntries.position, scoreId: scores.id, title: scores.title, composer: scores.composer })
      .from(setlistEntries)
      .innerJoin(scores, eq(scores.id, setlistEntries.scoreId))
      .where(and(eq(setlistEntries.eventId, eventId), cursor ? sql`${setlistEntries.position} > ${cursor[0]}` : undefined))
      .orderBy(asc(setlistEntries.position))
      .limit(limit + 1);
  }

  candidates(eventId: string, query: { q: string; cursor?: string; limit: number }): Promise<EventScoreCandidatesResponse> {
    const contained = sql<boolean>`exists (select 1 from setlist_entries x where x.event_id = ${eventId} and x.score_id = ${scores.id})`;
    return scoreCandidatePage(this.db, query, contained);
  }

  async createInActiveEnsemble(event: NewEvent): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [ensemble] = await tx.select({ archivedAt: ensembles.archivedAt }).from(ensembles).where(eq(ensembles.id, event.ensembleId)).for('update');
      if (!ensemble) throw ProblemException.notFound('Unknown ensemble');
      if (ensemble.archivedAt) throw ProblemException.validation([{ path: '/body/ensembleId', code: 'archived' }]);
      const id = uuidv7();
      await tx.insert(events).values({ id, ...event });
      return id;
    });
  }

  async update(eventId: string, changes: EventChanges): Promise<boolean> {
    const [result] = await this.db.update(events).set({ ...changes, updatedAt: new Date() }).where(eq(events.id, eventId));
    return result.affectedRows > 0;
  }

  async replaceSetlist(eventId: string, scoreIds: readonly string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId)).for('update');
      if (!event) throw ProblemException.notFound();
      if (scoreIds.length) {
        const found = await tx.select({ id: scores.id }).from(scores).where(inArray(scores.id, [...scoreIds]));
        if (found.length !== scoreIds.length) throw ProblemException.notFound('Unknown score');
      }
      await replaceRows(tx, setlistEntries, eq(setlistEntries.eventId, eventId), scoreIds.map((scoreId, i) => ({ eventId, scoreId, position: i + 1 })));
      await tx.update(events).set({ updatedAt: new Date() }).where(eq(events.id, eventId));
    });
  }

  async delete(eventId: string): Promise<void> {
    await this.db.delete(events).where(eq(events.id, eventId));
  }
}
