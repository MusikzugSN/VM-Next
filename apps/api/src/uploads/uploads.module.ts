import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UPLOAD_MAX_FILES } from '@vm-web/shared';
import { ensureUploadTempDir } from '../common/files/upload-temp';
import { AppConfig } from '../config/app-config.service';
import { MeModule } from '../me/me.module';
import { ReviewController } from './review.controller';
import { ReviewRepository } from './review.repository';
import { ReviewService } from './review.service';
import { UploadsController } from './uploads.controller';
import { UploadsRepository } from './uploads.repository';
import { UploadsService } from './uploads.service';

@Module({
  imports: [
    MeModule,
    // files go to a temp directory, not into memory; deleted after each request
    MulterModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        return {
          dest: ensureUploadTempDir(),
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
  providers: [UploadsService, UploadsRepository, ReviewService, ReviewRepository],
})
export class UploadsModule {}
