import { Module } from '@nestjs/common';

import { PrintRulesService } from './print-rules.service';

/** Print rules per ensemble (S-2, D-6), used by the system pages and by printing. */
@Module({
  providers: [PrintRulesService],
  exports: [PrintRulesService],
})
export class PrintRulesModule {}
