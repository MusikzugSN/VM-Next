import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { axeViolations, pressKey, uiTestingImports, uiTestingProviders, wait } from '../../testing/ui-testing';
import { VmMenuImports } from './vm-menu';

@Component({
  imports: [VmMenuImports],
  template: `
    <button type="button" vm-menu-trigger id="trigger" [zDropdownMenu]="menu">{{ label() }}</button>
    <vm-menu-content #menu="zDropdownMenuContent">
      <vm-menu-label>Mappe</vm-menu-label>
      <button type="button" vm-menu-item (click)="chosen.set('edit')">Bearbeiten</button>
      <button type="button" vm-menu-item disabled (click)="chosen.set('copy')">Kopieren</button>
      <a vm-menu-item href="/druck" (click)="chosen.set('print')">Drucken</a>
      <vm-menu-separator />
      <button type="button" vm-menu-item (click)="chosen.set('delete')">Löschen</button>
    </vm-menu-content>
  `,
})
class MenuHost {
  readonly label = signal('Aktionen');
  readonly chosen = signal<string | null>(null);
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let round = 0; round < 3; round++) {
    await fixture.whenStable();
    await wait();
  }
}

function trigger(): HTMLElement {
  return document.getElementById('trigger') as HTMLElement;
}

function menu(): HTMLElement | null {
  return document.querySelector('.cdk-overlay-container [role="menu"]');
}

function focusedText(): string | undefined {
  return document.activeElement?.textContent?.trim();
}

describe('VmMenu', () => {
  let fixture: ComponentFixture<MenuHost>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [MenuHost, ...uiTestingImports], providers: uiTestingProviders });
    fixture = TestBed.createComponent(MenuHost);
    await settle(fixture);
    trigger().focus();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('opens with Enter and focuses the first item', async () => {
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');

    pressKey(trigger(), 'Enter');
    await settle(fixture);

    expect(menu()).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(focusedText()).toBe('Bearbeiten');
  });

  it('opens with ArrowUp on the last item', async () => {
    pressKey(trigger(), 'ArrowUp');
    await settle(fixture);

    expect(focusedText()).toBe('Löschen');
  });

  it('moves with the arrow keys, skips disabled items and wraps around', async () => {
    pressKey(trigger(), 'ArrowDown');
    await settle(fixture);
    expect(focusedText()).toBe('Bearbeiten');

    pressKey(document.activeElement as HTMLElement, 'ArrowDown');
    expect(focusedText()).toBe('Drucken');

    pressKey(document.activeElement as HTMLElement, 'ArrowDown');
    expect(focusedText()).toBe('Löschen');

    pressKey(document.activeElement as HTMLElement, 'ArrowDown');
    expect(focusedText()).toBe('Bearbeiten');

    pressKey(document.activeElement as HTMLElement, 'ArrowUp');
    expect(focusedText()).toBe('Löschen');

    pressKey(document.activeElement as HTMLElement, 'Home');
    expect(focusedText()).toBe('Bearbeiten');

    pressKey(document.activeElement as HTMLElement, 'End');
    expect(focusedText()).toBe('Löschen');
  });

  it('selects the focused item with Enter, closes and returns the focus', async () => {
    pressKey(trigger(), 'Enter');
    await settle(fixture);
    pressKey(document.activeElement as HTMLElement, 'ArrowDown');
    pressKey(document.activeElement as HTMLElement, 'ArrowDown');
    expect(focusedText()).toBe('Löschen');

    pressKey(document.activeElement as HTMLElement, 'Enter');
    await settle(fixture);

    expect(fixture.componentInstance.chosen()).toBe('delete');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on Escape and returns the focus to the trigger', async () => {
    pressKey(trigger(), 'Enter');
    await settle(fixture);

    pressKey(document.activeElement as HTMLElement, 'Escape');
    await settle(fixture);

    expect(menu()).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
    expect(fixture.componentInstance.chosen()).toBeNull();
  });

  it('keeps the visible text as the accessible name when it changes', async () => {
    fixture.componentInstance.label.set('Spalten 4/8');
    await settle(fixture);

    expect(trigger().hasAttribute('aria-label')).toBe(false);
    expect(trigger().textContent?.trim()).toBe('Spalten 4/8');
  });

  it('has no axe violations, closed and open', async () => {
    expect(await axeViolations(document.body)).toEqual([]);

    pressKey(trigger(), 'Enter');
    await settle(fixture);

    expect(await axeViolations(document.body)).toEqual([]);
  });
});
