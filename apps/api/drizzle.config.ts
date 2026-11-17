import { defineConfig } from 'drizzle-kit';

// Run from apps/api (see the db:* scripts in the root package.json): drizzle-kit resolves
// path aliases like @vm-web/shared through the tsconfig.json of the working directory.
// drizzle-kit does not load .env files itself.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env – DATABASE_URL must come from the environment
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: process.env['DATABASE_URL'] ?? '' },
  strict: true,
  verbose: true,
});
