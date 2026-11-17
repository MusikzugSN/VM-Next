import { Logger, type LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_PREFIX } from '@vm-web/shared';
import { AppModule } from './app/app.module';
import { AppConfig } from './config/app-config.service';

const LOG_LEVELS: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(AppConfig);

  app.useLogger(LOG_LEVELS.slice(0, LOG_LEVELS.indexOf(config.get('LOG_LEVEL')) + 1));
  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''), { exclude: ['health'] });
  app.disable('x-powered-by');
  if (config.get('TRUST_PROXY')) app.set('trust proxy', 1);
  app.enableShutdownHooks();

  const host = config.get('HOST');
  const port = config.get('PORT');
  await app.listen(port, host);

  // Set when Nx waits for this server to be ready
  if (process.env['NX_READY_SIGNAL_SOCKET']) {
    try {
      // Function keeps TypeScript and bundlers from rewriting or bundling the import
      const load = new Function('s', 'return import(s)') as (
        s: string,
      ) => Promise<{ emitReadySignal(server: unknown): boolean }>;
      (await load('@nx/js/ready-signal')).emitReadySignal(app.getHttpServer());
    } catch {
      // @nx/js isn't installed
    }
  }
  Logger.log(`API listening on http://${host}:${port}${API_PREFIX}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
