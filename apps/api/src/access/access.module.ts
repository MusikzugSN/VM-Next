import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessRepository } from './access.repository';
import { EnsembleResolvers } from './ensemble-resolvers';
import { PermissionGuard } from './permission.guard';
import { SessionGuard } from './session.guard';
import { SessionStore } from './session.store';

/** Sessions and permission checks for every route. Guards run in registration order. */
@Global()
@Module({
  providers: [
    AccessRepository,
    SessionStore,
    EnsembleResolvers,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [AccessRepository, SessionStore, EnsembleResolvers],
})
export class AccessModule {}
