import { Inject, Injectable } from '@nestjs/common';
import type { AccessContext } from '../access/access-context';
import { uuidv7 } from '../common/ids/uuid-v7';
import { ProblemException } from '../common/problem-details/problem.exception';
import { isUniqueViolation } from '../db/db-errors';
import { MeRepository } from './me.repository';

/** Personal tags: everyone may create them, only their owner sees them (M-8, F-2). */
@Injectable()
export class PersonalTagsService {
  constructor(@Inject(MeRepository) private readonly repo: MeRepository) {}

  async create(userId: string, name: string): Promise<{ id: string }> {
    if (await this.repo.personalTagNameTaken(userId, name)) throw ProblemException.conflict('name-taken');
    const id = uuidv7();
    await nameTakenOnRace(() => this.repo.insertPersonalTag(id, userId, name));
    return { id };
  }

  async rename(userId: string, tagId: string, name: string): Promise<void> {
    await this.ownTag(userId, tagId);
    if (await this.repo.personalTagNameTaken(userId, name, tagId)) throw ProblemException.conflict('name-taken');
    await nameTakenOnRace(() => this.repo.renamePersonalTag(tagId, name));
  }

  async delete(userId: string, tagId: string): Promise<void> {
    await this.ownTag(userId, tagId);
    await this.repo.deletePersonalTag(tagId);
  }

  /** Idempotent; the score must be visible in Mein Bereich. */
  async add(access: AccessContext, scoreId: string, tagId: string): Promise<void> {
    await this.ownTag(access.userId, tagId);
    if (!(await this.repo.visibleScore(access.memberEnsembleIds(), scoreId))) throw ProblemException.notFound();
    await this.repo.tagScore(tagId, scoreId);
  }

  /** Idempotent. Removing works even if the score is no longer visible. */
  async remove(access: AccessContext, scoreId: string, tagId: string): Promise<void> {
    await this.ownTag(access.userId, tagId);
    await this.repo.untagScore(tagId, scoreId);
  }

  /** Foreign tags behave like missing ones (404). */
  private async ownTag(userId: string, tagId: string): Promise<void> {
    if (!(await this.repo.personalTagOf(userId, tagId))) throw ProblemException.notFound();
  }
}

/** The unique index decides when two requests create the same name at once. */
async function nameTakenOnRace(write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (error) {
    if (isUniqueViolation(error)) throw ProblemException.conflict('name-taken');
    throw error;
  }
}
