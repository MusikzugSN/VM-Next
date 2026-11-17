import { INestApplication, type ModuleMetadata, type Provider } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { CSRF_HEADER, SESSION_COOKIE } from '@vm-web/shared';
import { AccessRepository } from '../access/access.repository';
import { EnsembleResolvers } from '../access/ensemble-resolvers';
import { PermissionGuard } from '../access/permission.guard';
import { SessionGuard } from '../access/session.guard';
import { SessionStore } from '../access/session.store';
import { CACHE_SERVICE } from '../cache/cache.service';
import { InMemoryCacheService } from '../cache/in-memory-cache.service';
import { ProblemDetailsFilter } from '../common/problem-details/problem-details.filter';
import { ZodResponseInterceptor } from '../common/validation/zod-response.interceptor';
import { AppConfig } from '../config/app-config.service';
import { DATABASE, type Database } from '../db/database';
import { FakeAccessRepository, fakeConfig, PEOPLE, type PersonKey } from './access-fixtures';

export interface TestApp {
  app: INestApplication;
  baseUrl: string;
  sessions: SessionStore;
  /** Logs a fixture person (or a user id from the database) in; returns session cookie and CSRF header. */
  loginAs(person: PersonKey | { userId: string }): Promise<Record<string, string>>;
  close(): Promise<void>;
}

export interface TestAppOptions {
  providers?: Provider[];
  config?: Record<string, unknown>;
  /** Real database: then the real `AccessRepository` is used instead of the fixture people. */
  database?: Database;
}

/**
 * Nest app with the real guards, filter and interceptor and an in-memory cache –
 * with fixture people (default) or a real test database.
 */
export async function createTestApp(metadata: ModuleMetadata, options: TestAppOptions = {}): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    ...metadata,
    providers: [
      ...(metadata.providers ?? []),
      { provide: AppConfig, useValue: fakeConfig(options.config) },
      { provide: CACHE_SERVICE, useClass: InMemoryCacheService },
      options.database
        ? AccessRepository
        : { provide: AccessRepository, useClass: FakeAccessRepository },
      ...(options.database ? [{ provide: DATABASE, useValue: options.database }] : []),
      SessionStore,
      EnsembleResolvers,
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: PermissionGuard },
      { provide: APP_FILTER, useClass: ProblemDetailsFilter },
      { provide: APP_INTERCEPTOR, useClass: ZodResponseInterceptor },
      ...(options.providers ?? []),
    ],
  }).compile();

  // TEST_LOG=1 shows server errors while debugging tests
  const app = moduleRef.createNestApplication({ logger: process.env['TEST_LOG'] ? ['error', 'warn'] : false });
  app.setGlobalPrefix('internal/v1');
  await app.listen(0, '127.0.0.1');
  const baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1') + '/internal/v1';
  const sessions = app.get(SessionStore);

  return {
    app,
    baseUrl,
    sessions,
    async loginAs(person) {
      const userId = typeof person === 'string' ? PEOPLE[person].user.id : person.userId;
      const { id, data } = await sessions.create(userId, null);
      return { cookie: `${SESSION_COOKIE}=${id}`, [CSRF_HEADER]: data.csrfToken };
    },
    close: () => app.close(),
  };
}
