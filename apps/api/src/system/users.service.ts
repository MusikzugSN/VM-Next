import { Inject, Injectable } from '@nestjs/common';
import type { Page, UserAssignmentOptionsResponse, UserDetailsResponse, UserRow, UserTableQuery } from '@vm-web/shared';
import type { AccessContext } from '../access/access-context';
import { decodeCursor, toPage } from '../common/pagination/cursor';
import { ProblemException } from '../common/problem-details/problem.exception';
import { httpUrlOrNull } from '../common/url';
import { assertKnownIds } from '../common/validation/id-list';
import { assertEnsembleInScope } from '../library/library-helpers';
import { SystemUsersRepository, type AdminGuardState, type UserRecord } from './users.repository';

type Extras = Awaited<ReturnType<UsersService['extras']>>;

@Injectable()
export class UsersService {
  constructor(@Inject(SystemUsersRepository) private readonly repo: SystemUsersRepository) {}

  async table(query: UserTableQuery): Promise<Page<UserRow>> {
    const rows = await this.repo.page(query, decodeCursor(query.cursor, 2));
    const page = rows.slice(0, query.limit).map((r) => r.user);
    const extras = await this.extras(page.map((u) => u.id));
    return toPage(rows, query.limit, (r) => [r.sortKey, r.user.id], (r) => toRow(r.user, extras));
  }

  async details(userId: string): Promise<UserDetailsResponse> {
    const user = await this.user(userId);
    const extras = await this.extras([userId]);
    return {
      ...toRow(user, extras),
      createdAt: user.createdAt.toISOString(),
      canBeDemoted: !isLastAdmin(user, await this.repo.activeAdminCount()),
    };
  }

  async assignmentOptions(access: AccessContext): Promise<UserAssignmentOptionsResponse> {
    const [ensembleRows, roleRows] = await Promise.all([this.repo.ensembleOptions(access, 'user.edit'), this.repo.roleOptions()]);
    return { ensembles: ensembleRows, roles: roleRows };
  }

  async setMembership(access: AccessContext, userId: string, ensembleId: string, roleId: string): Promise<void> {
    assertEnsembleInScope(access, 'user.edit', ensembleId);
    await this.repo.setMembership(userId, ensembleId, roleId, ({ user, ensemble, roleExists }) => {
      if (!user) throw ProblemException.notFound();
      if (!ensemble) throw ProblemException.notFound('Unknown ensemble');
      if (ensemble.archivedAt) throw ProblemException.validation([{ path: '/body/ensembleId', code: 'archived' }]);
      if (!roleExists) throw ProblemException.notFound('Unknown role');
    });
  }

  async removeMembership(access: AccessContext, userId: string, ensembleId: string): Promise<void> {
    assertEnsembleInScope(access, 'user.edit', ensembleId);
    if (!(await this.repo.removeMembership(userId, ensembleId))) throw ProblemException.notFound();
  }

  async setVoices(userId: string, voiceIds: readonly string[]): Promise<void> {
    await this.user(userId);
    const unique = [...new Set(voiceIds)];
    assertKnownIds(voiceIds, await this.repo.existingVoiceIds(unique), '/body/voiceIds', 'unknown_voice');
    await this.repo.setVoices(userId, unique);
  }

  async block(actorId: string, userId: string): Promise<void> {
    await this.repo.block(userId, (state) => assertRemovable(actorId, userId, state));
  }

  async unblock(userId: string): Promise<void> {
    await this.user(userId);
    await this.repo.setStatus(userId, 'active');
  }

  async setAdmin(userId: string, isAdmin: boolean): Promise<void> {
    if (isAdmin) {
      await this.user(userId);
      await this.repo.grantAdmin(userId);
      return;
    }
    await this.repo.revokeAdmin(userId, ({ user, activeAdmins }) => {
      if (!user) throw ProblemException.notFound();
      if (isLastAdmin(user, activeAdmins)) throw ProblemException.conflict('last-admin');
    });
  }

  async delete(actorId: string, userId: string): Promise<void> {
    await this.repo.delete(userId, (state) => assertRemovable(actorId, userId, state));
  }

  async extras(userIds: readonly string[]) {
    const [memberRows, voiceRows] = await Promise.all([this.repo.memberships(userIds), this.repo.profileVoices(userIds)]);
    return {
      memberships: (id: string) => memberRows.filter((m) => m.userId === id).map(({ ensemble, role }) => ({ ensemble, role })),
      voices: (id: string) => voiceRows.filter((v) => v.userId === id).map(({ id: vid, name, instrumentId }) => ({ id: vid, name, instrumentId })),
    };
  }

  private async user(userId: string): Promise<UserRecord> {
    const user = await this.repo.find(userId);
    if (!user) throw ProblemException.notFound();
    return user;
  }
}

function isLastAdmin(user: UserRecord, activeAdmins: number): boolean {
  return user.isAdmin && user.status === 'active' && activeAdmins <= 1;
}

function assertRemovable(actorId: string, userId: string, { user, activeAdmins }: AdminGuardState): void {
  if (!user) throw ProblemException.notFound();
  if (userId === actorId || isLastAdmin(user, activeAdmins)) throw ProblemException.conflict('last-admin');
}

function toRow(u: UserRecord, extras: Extras): UserRow {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    pictureUrl: httpUrlOrNull(u.pictureUrl),
    memberships: extras.memberships(u.id),
    voices: extras.voices(u.id),
    status: u.status,
    isAdmin: u.isAdmin,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  };
}
