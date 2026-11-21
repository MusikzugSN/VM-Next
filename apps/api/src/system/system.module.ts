import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { LOGO_MAX_BYTES } from '@vm-web/shared';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrintRulesModule } from '../print-rules/print-rules.module';
import { ConfigService } from './config.service';
import { EnsemblesService } from './ensembles.service';
import { RolesService } from './roles.service';
import { SystemConfigController, SystemEnsemblesController, SystemRolesController, SystemUsersController } from './system.controller';
import { UsersService } from './users.service';

/** Logo upload: temp file, max. 2 MB, one file. */
export const logoMulterOptions = () => {
  const dest = join(tmpdir(), 'vmweb-uploads');
  mkdirSync(dest, { recursive: true });
  return { dest, limits: { fileSize: LOGO_MAX_BYTES, files: 1, fields: 2 } };
};

@Module({
  imports: [MulterModule.registerAsync({ useFactory: logoMulterOptions }), PrintRulesModule],
  controllers: [SystemUsersController, SystemEnsemblesController, SystemRolesController, SystemConfigController],
  providers: [UsersService, EnsemblesService, RolesService, ConfigService],
})
export class SystemModule {}
