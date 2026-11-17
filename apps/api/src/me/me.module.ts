import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { MeRepository } from './me.repository';
import { MeService } from './me.service';
import { PersonalTagsService } from './personal-tags.service';

@Module({
  controllers: [MeController],
  providers: [MeRepository, MeService, PersonalTagsService],
  exports: [MeService, MeRepository],
})
export class MeModule {}
