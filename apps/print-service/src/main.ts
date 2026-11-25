import { loadConfig } from './config';
import { CupsBackend } from './cups-backend';
import { JobService } from './jobs';
import { createPrintServer } from './server';
import { ReleaseUpdater, defaultUpdaterDeps } from './updater';

/** Exit code after an update: systemd (`Restart=on-failure`) only restarts on a non-zero code. */
const EXIT_RESTART = 75;

/** Set by scripts/build-sea.mjs from the release version; absent in `nx build`/`nx serve`. */
declare const __VMWEB_PRINT_VERSION__: string | undefined;

/** Version of the service, reported by GET /v1/status. */
const VERSION = typeof __VMWEB_PRINT_VERSION__ === 'string' ? __VMWEB_PRINT_VERSION__ : '0.0.0-dev';

/**
 * VM-Web Druckservice (D-3 bis D-5): listens on 127.0.0.1 only and prints jobs from the configured
 * VM-Web address on a local printer through CUPS. See docs/print-service.md.
 */
function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
  const backend = new CupsBackend();
  const jobs = new JobService(backend, config.dataDir, config.retentionDays);
  const updater = new ReleaseUpdater(defaultUpdaterDeps(VERSION));
  const server = createPrintServer({
    config,
    backend,
    jobs,
    version: VERSION,
    updater,
    restart: () => {
      console.log('Update installiert – Druckservice startet neu.');
      server.close(() => process.exit(EXIT_RESTART));
      // Open keep-alive connections must not hold the restart back
      setTimeout(() => process.exit(EXIT_RESTART), 2000).unref();
    },
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${config.port} ist belegt – läuft der Druckservice schon?` : error.message);
    process.exit(1);
  });
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`VM-Web Druckservice ${VERSION} auf http://127.0.0.1:${config.port}/v1 – erlaubt: ${config.allowedOrigin}`);
  });

  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main();
