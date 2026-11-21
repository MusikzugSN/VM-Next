import { Global, Module } from '@nestjs/common';
import { CACHE_SERVICE } from './cache.service';
import { PostgresCacheService } from './postgres-cache.service';

/**
 * Sessions and login state live in Postgres (`cache_entries`), so an API restart does not sign
 * everybody out. Tests swap in `InMemoryCacheService`; consumers only see `ICacheService`.
 */
@Global()
@Module({
  providers: [{ provide: CACHE_SERVICE, useClass: PostgresCacheService }],
  exports: [CACHE_SERVICE],
})
export class AppCacheModule {}
