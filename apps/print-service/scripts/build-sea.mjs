// Builds the print service as a single executable (Node SEA) plus an install tarball:
//   dist/apps/print-service-sea/vm-web-print
//   dist/apps/print-service-sea/vm-web-print-<version>-linux-<arch>.tar.gz
// Runs on Linux (CI or apps/print-service/Dockerfile.sea); the binary is for the platform it was
// built on. The version comes from the root package.json and is reported by GET /v1/status.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

if (process.platform !== 'linux') {
  console.error('build-sea runs on Linux only. On Windows: pnpm print:sea (builds in Docker).');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const app = join(root, 'apps/print-service');
const outDir = join(root, 'dist/apps/print-service-sea');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const arch = { x64: 'x64', arm64: 'arm64' }[process.arch];
if (!arch) throw new Error(`Unsupported architecture ${process.arch}`);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// 1. One CommonJS file with every dependency (zod, @vm-web/shared) inside
const bundle = join(outDir, 'main.cjs');
await build({
  entryPoints: [join(app, 'src/main.ts')],
  outfile: bundle,
  tsconfig: join(app, 'tsconfig.app.json'),
  bundle: true,
  platform: 'node',
  target: `node${process.versions.node.split('.')[0]}`,
  format: 'cjs',
  legalComments: 'none',
  define: { __VMWEB_PRINT_VERSION__: JSON.stringify(version) },
  logLevel: 'warning',
});

// 2. SEA blob
const blob = join(outDir, 'sea-prep.blob');
const seaConfig = join(outDir, 'sea-config.json');
writeFileSync(
  seaConfig,
  JSON.stringify({ main: bundle, output: blob, disableExperimentalSEAWarning: true, useCodeCache: true }, null, 2),
);
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' });

// 3. Copy of the node binary with the blob injected
const binary = join(outDir, 'vm-web-print');
copyFileSync(process.execPath, binary);
chmodSync(binary, 0o755);
execFileSync(
  process.execPath,
  [
    require.resolve('postject/dist/cli.js'),
    binary,
    'NODE_SEA_BLOB',
    blob,
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ],
  { stdio: 'inherit' },
);

// 4. Tarball: binary, install script, systemd unit, README
const name = `vm-web-print-${version}-linux-${arch}`;
const stage = join(outDir, name);
mkdirSync(stage);
copyFileSync(binary, join(stage, 'vm-web-print'));
chmodSync(join(stage, 'vm-web-print'), 0o755);
copyFileSync(join(app, 'deploy/install.sh'), join(stage, 'install.sh'));
chmodSync(join(stage, 'install.sh'), 0o755);
copyFileSync(join(app, 'deploy/vm-web-print.service'), join(stage, 'vm-web-print.service'));
copyFileSync(join(app, 'README.md'), join(stage, 'README.md'));
execFileSync('tar', ['-czf', `${name}.tar.gz`, name], { cwd: outDir, stdio: 'inherit' });
rmSync(stage, { recursive: true });
rmSync(blob);
rmSync(seaConfig);

console.log(`Built ${binary} (${version}) and ${join(outDir, `${name}.tar.gz`)}`);
