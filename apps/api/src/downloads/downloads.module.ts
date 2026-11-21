import { Module } from '@nestjs/common';
import { MeModule } from '../me/me.module';
import { PrintRulesModule } from '../print-rules/print-rules.module';
import { DownloadsController, PrintController } from './downloads.controller';
import { DownloadsService } from './downloads.service';
import { OutputService } from './output.service';

@Module({
  imports: [MeModule, PrintRulesModule],
  controllers: [DownloadsController, PrintController],
  providers: [OutputService, DownloadsService],
})
export class DownloadsModule {}
