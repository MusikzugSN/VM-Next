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
import type { AccessContext } from '../access/access-context';
import { EnsembleResolvers } from '../access/ensemble-resolvers';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { todayIn } from '../common/time/today';
import { assertNoDuplicates } from '../common/validation/id-list';
import { AppConfig } from '../config/app-config.service';
import { listEnsembles } from '../library/library-helpers';
import { EventsRepository, type EventChanges } from './events.repository';

@Injectable()
export class EventsService implements OnModuleInit {
  constructor(
    @Inject(EventsRepository) private readonly repo: EventsRepository,
    @Inject(EnsembleResolvers) private readonly resolvers: EnsembleResolvers,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.resolvers.register('event', (id) => this.repo.ensembleIdOf(id));
  }

  async ensembleOptions(access: AccessContext) {
    const ids = access.ensemblesWith('event.create');
    if (!ids.length) throw ProblemException.forbidden();
    return { items: await this.repo.activeEnsembleOptions(ids) };
  }

  async list(access: AccessContext, query: EventListQuery): Promise<Page<EventListItem>> {
    const ensembleIds = listEnsembles(access, 'event.view', query.ensembleId);
    if (!ensembleIds.length) return { items: [], nextCursor: null };
    const rows = await this.repo.list({
      ensembleIds,
      upcoming: query.period === 'upcoming',
      today: todayIn(this.config.get('APP_TIMEZONE')),
      q: query.q,
      cursor: decodeCursor(query.cursor, 2),
      limit: query.limit,
    });
    return toPage(rows, query.limit, (r) => [r.date, r.id], (r) => r);
  }

  async details(eventId: string): Promise<EventDetailsResponse> {
    const row = await this.repo.details(eventId);
    if (!row) throw ProblemException.notFound();
    return row;
  }

  async setlist(eventId: string, query: { cursor?: string; limit: number }): Promise<Page<SetlistEntry>> {
    const rows = await this.repo.setlist(eventId, decodeCursor(query.cursor, 1), query.limit);
    return toPage(rows, query.limit, (r) => [r.position], (r) => r);
  }

  candidates(eventId: string, query: { q: string; cursor?: string; limit: number }): Promise<EventScoreCandidatesResponse> {
    return this.repo.candidates(eventId, query);
  }

  async create(body: CreateEventBody): Promise<{ id: string }> {
    const id = await this.repo.createInActiveEnsemble({ ensembleId: body.ensembleId, name: body.name, date: body.date, showInMyArea: body.showInMyArea });
    return { id };
  }

  async updateDetails(eventId: string, body: UpdateEventDetailsBody): Promise<void> {
    await this.update(eventId, { name: body.name, date: body.date });
  }

  async setVisibility(eventId: string, showInMyArea: boolean): Promise<void> {
    await this.update(eventId, { showInMyArea });
  }

  async setSetlist(eventId: string, scoreIds: readonly string[]): Promise<void> {
    assertNoDuplicates(scoreIds, '/body/scoreIds');
    await this.repo.replaceSetlist(eventId, scoreIds);
  }

  async delete(eventId: string): Promise<void> {
    await this.repo.delete(eventId);
  }

  private async update(eventId: string, changes: EventChanges): Promise<void> {
    if (!(await this.repo.update(eventId, changes))) throw ProblemException.notFound();
  }
}
