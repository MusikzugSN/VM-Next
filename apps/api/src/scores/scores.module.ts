import { Module } from '@nestjs/common';
import { MeModule } from '../me/me.module';
import { FieldsService } from './fields.service';
import { ScoreImportService } from './score-import.service';
import { ScoresController } from './scores.controller';
import { ScoresRepository } from './scores.repository';
import { ScoresService } from './scores.service';

@Module({
  imports: [MeModule],
  controllers: [ScoresController],
  providers: [ScoresRepository, ScoresService, FieldsService, ScoreImportService],
  exports: [ScoresRepository],
})
export class ScoresModule {}
