import { Global, Module } from '@nestjs/common';
import { ClubSettingsRepository } from './club-settings.repository';

@Global()
@Module({
  providers: [ClubSettingsRepository],
  exports: [ClubSettingsRepository],
})
export class SettingsModule {}
