import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type {
  CreateEventBody,
  EventDetailsResponse,
  EventListItem,
  EventListQuery,
  EventScoreCandidatesResponse,
  Page,
  SetlistEntry,
  UpdateEventDetailsBody,
} from '@vm-web/shared';
import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { AccessContext } from '../access/access-context';
import { EnsembleResolvers } from '../access/ensemble-resolvers';
import { uuidv7 } from '../common/ids/uuid-v7';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { todayIn } from '../common/time/today';
import { AppConfig } from '../config/app-config.service';
import { DATABASE, type Database } from '../db/database';
import { ensembles, events, scores, setlistEntries } from '../db/schema';
import { assertActiveEnsemble, ensembleOptions, listEnsembles, scoreCandidates } from '../library/library-helpers';
import { likePattern } from '../me/me.repository';

const scoreCount = sql<number>`(select count(*)::int from setlist_entries x where x.event_id = ${events.id})`;

/** Events of ensembles with date and setlist (N-15, N-16). Permissions: `event.*` in the event's ensemble. */
@Injectable()
export class EventsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(EnsembleResolvers) private readonly resolvers: EnsembleResolvers,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.resolvers.register('event', async (id) => {
      const [row] = await this.db.select({ ensembleId: events.ensembleId }).from(events).where(eq(events.id, id));
      return row?.ensembleId ?? null;
    });
  }

  ensembleOptions(access: AccessContext) {
    return ensembleOptions(this.db, access, 'event.create').then((items) => ({ items }));
  }

  /** `upcoming`: from today, ascending; `past`: descending. */
  async list(access: AccessContext, query: EventListQuery): Promise<Page<EventListItem>> {
    const ids = listEnsembles(access, 'event.view', query.ensembleId);
    if (!ids.length) return { items: [], nextCursor: null };
    const upcoming = query.period === 'upcoming';
    const today = todayIn(this.config.get('APP_TIMEZONE'));
    const cursor = decodeCursor(query.cursor, 2);
    const rows = await this.db
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
          inArray(events.ensembleId, ids),
          upcoming ? gte(events.date, today) : lt(events.date, today),
          query.q ? sql`${events.name} ilike ${likePattern(query.q)}` : undefined,
          cursor
            ? upcoming
              ? sql`(${events.date}, ${events.id}) > (${cursor[0]}::date, ${cursor[1]}::uuid)`
              : sql`(${events.date}, ${events.id}) < (${cursor[0]}::date, ${cursor[1]}::uuid)`
            : undefined,
        ),
      )
      .orderBy(...(upcoming ? [asc(events.date), asc(events.id)] : [desc(events.date), desc(events.id)]))
      .limit(query.limit + 1);
    return toPage(rows, query.limit, (r) => [r.date, r.id], (r) => r);
  }

  async details(eventId: string): Promise<EventDetailsResponse> {
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
    if (!row) throw ProblemException.notFound();
    return { ...row, updatedAt: row.updatedAt.toISOString() };
  }

  async setlist(eventId: string, query: { cursor?: string; limit: number }): Promise<Page<SetlistEntry>> {
    const cursor = decodeCursor(query.cursor, 1);
    const rows = await this.db
      .select({ position: setlistEntries.position, scoreId: scores.id, title: scores.title, composer: scores.composer })
      .from(setlistEntries)
      .innerJoin(scores, eq(scores.id, setlistEntries.scoreId))
      .where(and(eq(setlistEntries.eventId, eventId), cursor ? sql`${setlistEntries.position} > ${cursor[0]}` : undefined))
      .orderBy(asc(setlistEntries.position))
      .limit(query.limit + 1);
    return toPage(rows, query.limit, (r) => [r.position], (r) => r);
  }

  async candidates(eventId: string, query: { q: string; cursor?: string; limit: number }): Promise<EventScoreCandidatesResponse> {
    const contained = sql<boolean>`exists (select 1 from setlist_entries x where x.event_id = ${eventId}::uuid and x.score_id = ${scores.id})`;
    const rows = await scoreCandidates(this.db, query.q, contained, decodeCursor(query.cursor, 2), query.limit);
    return toPage(rows, query.limit, (r) => [r.sortKey, r.id], (r) => ({
      id: r.id,
      title: r.title,
      composer: r.composer,
      alreadyContained: r.alreadyContained,
    }));
  }

  async create(body: CreateEventBody): Promise<{ id: string }> {
    await assertActiveEnsemble(this.db, body.ensembleId);
    const id = uuidv7();
    await this.db.insert(events).values({ id, ensembleId: body.ensembleId, name: body.name, date: body.date, showInMyArea: body.showInMyArea });
    return { id };
  }

  async updateDetails(eventId: string, body: UpdateEventDetailsBody): Promise<void> {
    await this.touch(eventId, { name: body.name, date: body.date });
  }

  async setVisibility(eventId: string, showInMyArea: boolean): Promise<void> {
    await this.touch(eventId, { showInMyArea });
  }

  /** Replaces the whole setlist; order = playing order (N-16). Each score once. */
  async setSetlist(eventId: string, scoreIds: readonly string[]): Promise<void> {
    const duplicates = scoreIds.flatMap((id, i) => (scoreIds.indexOf(id) !== i ? [{ path: `/body/scoreIds/${i}`, code: 'duplicate' }] : []));
    if (duplicates.length) throw ProblemException.validation(duplicates);
    await this.db.transaction(async (tx) => {
      if (scoreIds.length) {
        const found = await tx.select({ id: scores.id }).from(scores).where(inArray(scores.id, [...scoreIds]));
        if (found.length !== scoreIds.length) throw ProblemException.notFound('Unknown score');
      }
      await tx.delete(setlistEntries).where(eq(setlistEntries.eventId, eventId));
      if (scoreIds.length) {
        await tx.insert(setlistEntries).values(scoreIds.map((scoreId, i) => ({ eventId, scoreId, position: i + 1 })));
      }
      await tx.update(events).set({ updatedAt: new Date() }).where(eq(events.id, eventId));
    });
  }

  async delete(eventId: string): Promise<void> {
    await this.db.delete(events).where(eq(events.id, eventId));
  }

  private async touch(eventId: string, set: Partial<typeof events.$inferInsert>): Promise<void> {
    const [row] = await this.db.update(events).set({ ...set, updatedAt: new Date() }).where(eq(events.id, eventId)).returning({ id: events.id });
    if (!row) throw ProblemException.notFound();
  }
}
