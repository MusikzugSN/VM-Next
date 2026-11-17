import { validateEnv } from './env.schema';

const minimal = {
  PUBLIC_BASE_URL: 'http://localhost:4200',
  DATABASE_URL: 'postgres://vmweb:vmweb@localhost:5432/vmweb',
  FILE_STORAGE_PATH: './tmp/storage',
  OIDC_ISSUER_URL: 'http://localhost:1411',
  OIDC_CLIENT_ID: 'client',
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(minimal);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      TRUST_PROXY: false,
      DB_MIGRATE_ON_START: true,
      UPLOAD_MAX_FILE_MB: 50,
      SESSION_IDLE_TTL_DAYS: 14,
      SESSION_ABSOLUTE_TTL_DAYS: 90,
      OIDC_SCOPES: 'openid profile email',
    });
    expect(env.OIDC_CLIENT_SECRET).toBeUndefined();
  });

  it('coerces numbers and booleans from strings', () => {
    const env = validateEnv({ ...minimal, PORT: '8080', TRUST_PROXY: '1', DB_MIGRATE_ON_START: 'false' });
    expect(env.PORT).toBe(8080);
    expect(env.TRUST_PROXY).toBe(true);
    expect(env.DB_MIGRATE_ON_START).toBe(false);
  });

  it('treats empty values as unset (KEY= in .env files)', () => {
    const env = validateEnv({ ...minimal, OIDC_CLIENT_SECRET: '', PORT: '', LOG_LEVEL: '' });
    expect(env.OIDC_CLIENT_SECRET).toBeUndefined();
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('log');
    expect(() => validateEnv({ ...minimal, OIDC_CLIENT_ID: '' })).toThrow(/- OIDC_CLIENT_ID:/);
  });

  it('lists every invalid variable in one error', () => {
    const run = () => validateEnv({ ...minimal, DATABASE_URL: 'mysql://x', OIDC_ISSUER_URL: undefined, PORT: '-1' });
    expect(run).toThrow(/^Invalid environment configuration/);
    for (const name of ['DATABASE_URL', 'OIDC_ISSUER_URL', 'PORT']) {
      expect(run).toThrow(new RegExp(`- ${name}:`));
    }
  });
});
