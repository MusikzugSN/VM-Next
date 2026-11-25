import { Module } from '@nestjs/common';
import { FileLegalTemplateSource, LEGAL_TEMPLATES } from './legal-template-source';
import { PublicLegalController, SystemLegalController } from './legal.controller';
import { LegalService } from './legal.service';
import { DrizzleLegalStore, LEGAL_STORE } from './legal.store';

/** Impressum & Datenschutzerklärung (S-7). `LegalService` is also used by the login page. */
@Module({
  controllers: [PublicLegalController, SystemLegalController],
  providers: [
    LegalService,
    { provide: LEGAL_STORE, useClass: DrizzleLegalStore },
    { provide: LEGAL_TEMPLATES, useClass: FileLegalTemplateSource },
  ],
  exports: [LegalService],
})
export class LegalPagesModule {}
