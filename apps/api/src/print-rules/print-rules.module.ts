import { Module } from '@nestjs/common';

import { PrintRulesRepository } from './print-rules.repository';
import { PrintRulesService } from './print-rules.service';

@Module({
  providers: [PrintRulesRepository, PrintRulesService],
  exports: [PrintRulesService],
})
export class PrintRulesModule {}
