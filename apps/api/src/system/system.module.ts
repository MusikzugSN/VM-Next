import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { LOGO_MAX_BYTES } from '@vm-web/shared';
import { ensureUploadTempDir } from '../common/files/upload-temp';
import { PrintRulesModule } from '../print-rules/print-rules.module';
import { ConfigRepository } from './config.repository';
import { ConfigService } from './config.service';
import { EnsemblesRepository } from './ensembles.repository';
import { EnsemblesService } from './ensembles.service';
import { RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';
import { SystemConfigController, SystemEnsemblesController, SystemRolesController, SystemUsersController } from './system.controller';
import { SystemUsersRepository } from './users.repository';
import { UsersService } from './users.service';

export const SYSTEM_PROVIDERS = [
  UsersService,
  SystemUsersRepository,
  EnsemblesService,
  EnsemblesRepository,
  RolesService,
  RolesRepository,
  ConfigService,
  ConfigRepository,
];

export const logoMulterOptions = () => ({ dest: ensureUploadTempDir(), limits: { fileSize: LOGO_MAX_BYTES, files: 1, fields: 2 } });

@Module({
  imports: [MulterModule.registerAsync({ useFactory: logoMulterOptions }), PrintRulesModule],
  controllers: [SystemUsersController, SystemEnsemblesController, SystemRolesController, SystemConfigController],
  providers: SYSTEM_PROVIDERS,
})
export class SystemModule {}
