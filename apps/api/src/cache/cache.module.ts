import { Global, Module } from '@nestjs/common';
import { CACHE_SERVICE } from './cache.service';
import { SqlCacheService } from './sql-cache.service';

/**
 * Sessions and login state live in the database (`cache_entries`), so an API restart does not
 * sign everybody out. Tests swap in `InMemoryCacheService`; consumers only see `ICacheService`.
 */
@Global()
@Module({
  providers: [{ provide: CACHE_SERVICE, useClass: SqlCacheService }],
  exports: [CACHE_SERVICE],
})
export class AppCacheModule {}
