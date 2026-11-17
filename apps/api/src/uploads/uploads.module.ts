import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UPLOAD_MAX_FILES } from '@vm-web/shared';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppConfig } from '../config/app-config.service';
import { MeModule } from '../me/me.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [
    MeModule,
    // files go to a temp directory, not into memory; deleted after each request
    MulterModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const dest = join(tmpdir(), 'vmweb-uploads');
        mkdirSync(dest, { recursive: true });
        return {
          dest,
          limits: {
            fileSize: config.get('UPLOAD_MAX_FILE_MB') * 1024 * 1024,
            files: UPLOAD_MAX_FILES,
            fields: 5,
            fieldSize: 1024 * 1024,
          },
        };
      },
    }),
  ],
  controllers: [UploadsController, ReviewController],
  providers: [UploadsService, ReviewService],
})
export class UploadsModule {}
