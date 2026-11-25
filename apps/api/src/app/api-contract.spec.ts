import { RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { API_PREFIX, API_ROUTES } from '@vm-web/shared';
import { ADMIN_KEY, MEMBER_KEY, PERMISSION_KEY, PUBLIC_KEY } from '../access/decorators';
import { RESPONSE_SCHEMA } from '../common/validation/zod-response.interceptor';
import { HealthController } from '../health/health.controller';

const CONFIG_REQUIRED_TO_IMPORT_APP_MODULE: Record<string, string> = {
  APP_TIMEZONE: 'Europe/Berlin',
  PUBLIC_BASE_URL: 'https://vm-web.invalid',
  DATABASE_URL: 'mysql://user:pw@127.0.0.1:3306/db',
  FILE_STORAGE_PATH: '/tmp/vm-web',
  OIDC_ISSUER_URL: 'https://idp.invalid/realms/vm-web',
  OIDC_CLIENT_ID: 'vm-web',
};
for (const [name, value] of Object.entries(CONFIG_REQUIRED_TO_IMPORT_APP_MODULE)) process.env[name] ??= value;

const { AppModule } = await import('./app.module');

type Ctor = new (...args: never[]) => object;
interface RouteDef {
  method: 'GET' | 'POST';
  path: string;
  binary?: true;
  multipart?: true;
  redirect?: true;
  public?: true;
}

const OUTSIDE_PREFIX: readonly unknown[] = [HealthController];
const METHOD_NAMES: Record<number, string> = { [RequestMethod.GET]: 'GET', [RequestMethod.POST]: 'POST' };

const segment = (value: unknown) => String(value ?? '').replace(/^\/+|\/+$/g, '');
const key = (method: string, base: string, path: string) =>
  [method, [API_PREFIX.replace(/^\/+|\/+$/g, ''), segment(base), segment(path)].filter(Boolean).join('/')].join(' ');

function modulesOf(entry: unknown, seen = new Set<unknown>()): unknown[] {
  const module = (entry as { module?: unknown })?.module ?? entry;
  if (!module || seen.has(module)) return [];
  seen.add(module);
  const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) as unknown[]) ?? [];
  return [module, ...imports.flatMap((imported) => modulesOf(imported, seen))];
}

interface Handler {
  controller: Ctor;
  method: string;
  route: string;
  fn: object;
}

function handlersOf(controller: Ctor): Handler[] {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  const prototype = controller.prototype as Record<string, object>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => ({ controller, method: `${controller.name}.${name}`, fn: prototype[name] }))
    .filter(({ fn }) => Reflect.getMetadata(METHOD_METADATA, fn) !== undefined)
    .map((handler) => ({
      ...handler,
      route: key(
        METHOD_NAMES[Reflect.getMetadata(METHOD_METADATA, handler.fn) as number] ?? 'OTHER',
        base,
        Reflect.getMetadata(PATH_METADATA, handler.fn) as string,
      ),
    }));
}

const declared = Object.entries(API_ROUTES).flatMap(([feature, group]) => {
  const { base, ...routes } = group as { base: string } & Record<string, RouteDef>;
  return Object.entries(routes).map(([name, def]) => ({ name: `${feature}.${name}`, def, route: key(def.method, base, def.path) }));
});
const declaredByRoute = new Map(declared.map((entry) => [entry.route, entry]));

const handlers = modulesOf(AppModule)
  .flatMap((module) => (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) as Ctor[]) ?? [])
  .filter((controller) => !OUTSIDE_PREFIX.includes(controller))
  .flatMap(handlersOf);

const metadata = (target: object, name: string) => Reflect.getMetadata(name, target) as unknown;
const classOf = (handler: Handler) => handler.controller;
const hasOwnOrClass = (handler: Handler, name: string) =>
  metadata(handler.fn, name) !== undefined || metadata(classOf(handler), name) !== undefined;

describe('API contract', () => {
  it('finds the controllers of every feature', () => {
    expect(handlers.length).toBeGreaterThan(100);
  });

  it('implements every route declared in API_ROUTES', () => {
    const implemented = new Set(handlers.map((handler) => handler.route));
    const missing = declared.filter((entry) => !implemented.has(entry.route)).map((entry) => `${entry.name}: ${entry.route}`);
    expect(missing).toEqual([]);
  });

  it('declares every implemented route in API_ROUTES', () => {
    const undeclared = handlers
      .filter((handler) => !declaredByRoute.has(handler.route))
      .map((handler) => `${handler.method}: ${handler.route}`);
    expect(undeclared).toEqual([]);
  });

  it('validates every response body against a schema', () => {
    const unchecked = handlers
      .filter((handler) => {
        const entry = declaredByRoute.get(handler.route);
        if (!entry || entry.def.binary || entry.def.redirect) return false;
        if (metadata(handler.fn, HTTP_CODE_METADATA) === 204) return false;
        return metadata(handler.fn, RESPONSE_SCHEMA) === undefined;
      })
      .map((handler) => `${handler.method}: ${handler.route}`);
    expect(unchecked).toEqual([]);
  });

  it('marks every route public, permission-guarded or member-only', () => {
    const guards = [PUBLIC_KEY, PERMISSION_KEY, ADMIN_KEY, MEMBER_KEY];
    const unguarded = handlers
      .filter((handler) => !guards.some((guard) => hasOwnOrClass(handler, guard)))
      .map((handler) => `${handler.method}: ${handler.route}`);
    expect(unguarded).toEqual([]);
  });
});
