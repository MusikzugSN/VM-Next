import { Module } from '@nestjs/common';
import { LegalPagesModule } from '../legal/legal-pages.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OIDC_CLIENT, OpenIdClient } from './oidc.client';
import { USERS_REPOSITORY, UsersRepository } from './users.repository';

@Module({
  imports: [LegalPagesModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: OIDC_CLIENT, useClass: OpenIdClient },
    { provide: USERS_REPOSITORY, useClass: UsersRepository },
  ],
})
export class AuthModule {}
