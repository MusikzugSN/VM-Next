import { Controller, Get, HttpCode, Inject, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from '../access/decorators';
import { DATABASE, type Database } from '../db/database';

/** `GET /health` – liveness/readiness for Docker, outside `/internal/v1` (see main.ts). */
@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  @HttpCode(200)
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new ServiceUnavailableException('Database not reachable');
    }
    return { status: 'ok' };
  }
}
