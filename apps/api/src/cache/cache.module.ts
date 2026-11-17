import { Global, Module } from '@nestjs/common';
import { CACHE_SERVICE } from './cache.service';
import { InMemoryCacheService } from './in-memory-cache.service';

/** Swap `useClass` for a Redis/Postgres implementation later; consumers only see `ICacheService`. */
@Global()
@Module({
  providers: [{ provide: CACHE_SERVICE, useClass: InMemoryCacheService }],
  exports: [CACHE_SERVICE],
})
export class AppCacheModule {}
