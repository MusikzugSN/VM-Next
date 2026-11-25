import { InjectionToken } from '@angular/core';

// The root package.json is no project, only the single source of the release version. Only
// `version` ends up in the bundle: esbuild drops the unused top-level keys of a JSON import.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { version } from '../../../../../package.json';

/**
 * Version of this VM-Web build. The release workflow writes it into the root package.json
 * (`.github/scripts/set-version.mjs`), the same source the print service binary is built from;
 * outside a release it is `0.0.0`.
 */
export const APP_VERSION = new InjectionToken<string>('APP_VERSION', { providedIn: 'root', factory: () => version });
