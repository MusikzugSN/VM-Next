import { Module } from '@nestjs/common';
import { MeModule } from '../me/me.module';
import { DownloadsController, PrintController } from './downloads.controller';
import { DownloadsService } from './downloads.service';
import { OutputService } from './output.service';

@Module({
  imports: [MeModule],
  controllers: [DownloadsController, PrintController],
  providers: [OutputService, DownloadsService],
})
export class DownloadsModule {}
