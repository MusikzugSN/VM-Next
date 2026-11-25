import { InteractivityChecker } from '@angular/cdk/a11y';
import { type EnvironmentProviders, Injectable, type Provider } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import axe from 'axe-core';

import { provideZard } from '../lib/zard/core/provider/providezard';

@Injectable()
class LayoutFreeInteractivityChecker extends InteractivityChecker {
  override isVisible(): boolean {
    return true;
  }
}

export const UI_TEST_TEXTS = { common: { close: 'Schließen' } };

export const uiTestingImports = [
  TranslocoTestingModule.forRoot({
    langs: { 'de-DE': UI_TEST_TEXTS },
    translocoConfig: { availableLangs: ['de-DE'], defaultLang: 'de-DE' },
    preloadLangs: true,
  }),
];

export const uiTestingProviders: (Provider | EnvironmentProviders)[] = [
  provideZard(),
  { provide: InteractivityChecker, useClass: LayoutFreeInteractivityChecker },
];

export async function axeViolations(root: Element): Promise<string[]> {
  const results = await axe.run(root, { rules: { region: { enabled: false } } });
  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')}`),
  );
}

export function pressKey(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

export function wait(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
