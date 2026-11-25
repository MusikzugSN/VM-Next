import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { AppCacheModule } from '../cache/cache.module';
import { ProblemDetailsFilter } from '../common/problem-details/problem-details.filter';
import { ZodResponseInterceptor } from '../common/validation/zod-response.interceptor';
import { AppConfigModule } from '../config/config.module';
import { DatabaseModule } from '../db/database.module';
import { DownloadsModule } from '../downloads/downloads.module';
import { HealthController } from '../health/health.controller';
import { LegalPagesModule } from '../legal/legal-pages.module';
import { EventsModule } from '../events/events.module';
import { FoldersModule } from '../folders/folders.module';
import { MeModule } from '../me/me.module';
import { ScoresModule } from '../scores/scores.module';
import { TagsModule } from '../tags/tags.module';
import { UploadsModule } from '../uploads/uploads.module';
import { VoicesModule } from '../voices/voices.module';
import { SeedModule } from '../seed/seed.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { SystemModule } from '../system/system.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AppCacheModule,
    StorageModule,
    SettingsModule,
    AccessModule,
    SeedModule,
    AuthModule,
    MeModule,
    ScoresModule,
    VoicesModule,
    FoldersModule,
    EventsModule,
    TagsModule,
    UploadsModule,
    DownloadsModule,
    SystemModule,
    LegalPagesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_INTERCEPTOR, useClass: ZodResponseInterceptor },
  ],
})
export class AppModule {}
