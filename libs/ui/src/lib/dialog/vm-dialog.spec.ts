import { ApplicationRef, Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { axeViolations, pressKey, uiTestingImports, uiTestingProviders, wait } from '../../testing/ui-testing';
import { VmButton } from '../button/vm-button';
import { VmInput } from '../field/vm-field';
import { VmConfirmDialogService, VmDialogImports, VmSheetImports } from './vm-dialog';

@Component({
  imports: [VmDialogImports, VmButton, VmInput],
  template: `
    <button type="button" id="opener" (click)="open.set(true)">Öffnen</button>
    <vm-dialog [(zVisible)]="open" [zClosable]="closable()" [zDuration]="0">
      <vm-dialog-header>
        <h2 vm-dialog-title>Mappe umbenennen</h2>
        <p vm-dialog-description>Der neue Name gilt für alle Mitglieder.</p>
      </vm-dialog-header>
      <input vm-input id="name" aria-label="Name" />
      <vm-dialog-footer>
        <button type="button" vm-button id="save">Speichern</button>
      </vm-dialog-footer>
    </vm-dialog>
  `,
})
class DialogHost {
  readonly open = signal(false);
  readonly closable = signal(true);
}

@Component({
  imports: [VmSheetImports],
  template: `
    <button type="button" id="opener" (click)="open.set(true)">Navigation</button>
    <vm-sheet [(zVisible)]="open" zSide="left" [zClosable]="closable()" [zDuration]="0">
      <vm-sheet-header><div vm-sheet-title>Musikzug</div></vm-sheet-header>
      <nav aria-label="Hauptnavigation">
        <a href="/start" id="first-link">Start</a>
        <a href="/noten" id="last-link">Noten</a>
      </nav>
    </vm-sheet>
  `,
})
class SheetHost {
  readonly open = signal(false);
  readonly closable = signal(true);
}

type OverlayHost = DialogHost | SheetHost;

async function settle(fixture?: ComponentFixture<unknown>): Promise<void> {
  for (let round = 0; round < 3; round++) {
    if (fixture) await fixture.whenStable();
    else await TestBed.inject(ApplicationRef).whenStable();
    await wait();
  }
}

async function render<T extends OverlayHost>(host: new () => T) {
  TestBed.configureTestingModule({ imports: [host, ...uiTestingImports], providers: uiTestingProviders });
  const fixture = TestBed.createComponent(host);
  await settle(fixture);
  return fixture;
}

async function openFromButton(fixture: ComponentFixture<OverlayHost>): Promise<HTMLElement> {
  const opener = document.getElementById('opener') as HTMLButtonElement;
  opener.focus();
  opener.click();
  await settle(fixture);
  return opener;
}

function panel(role = 'dialog'): HTMLElement | null {
  return document.querySelector(`.cdk-overlay-container [role="${role}"]`);
}

function focusTrapAnchors(element: HTMLElement): [HTMLElement, HTMLElement] {
  const anchors = [...(element.parentElement?.querySelectorAll<HTMLElement>('.cdk-focus-trap-anchor') ?? [])];
  return [anchors[0], anchors[anchors.length - 1]];
}

describe.each([
  ['VmDialog', DialogHost, 'name', 'save'],
  ['VmSheet', SheetHost, 'first-link', 'last-link'],
] as const)('%s', (_, host, _firstField, lastId) => {
  afterEach(() => TestBed.resetTestingModule());

  it('moves the focus into the panel and keeps it there while tabbing', async () => {
    const fixture = await render<OverlayHost>(host);
    await openFromButton(fixture);

    const dialog = panel();
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.contains(document.activeElement)).toBe(true);

    const [start, end] = focusTrapAnchors(dialog as HTMLElement);
    end.focus();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('z-close-header-button');
    start.focus();
    expect(document.activeElement?.id).toBe(lastId);
  });

  it('closes on Escape and returns the focus to the opener', async () => {
    const fixture = await render<OverlayHost>(host);
    const opener = await openFromButton(fixture);

    pressKey(document.activeElement ?? document.body, 'Escape');
    await settle(fixture);

    expect(fixture.componentInstance.open()).toBe(false);
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('stays open on Escape when it is not closable', async () => {
    const fixture = await render<OverlayHost>(host);
    fixture.componentInstance.closable.set(false);
    await openFromButton(fixture);

    pressKey(document.activeElement ?? document.body, 'Escape');
    await settle(fixture);

    expect(fixture.componentInstance.open()).toBe(true);
    expect(panel()).not.toBeNull();
    expect(document.querySelector('[data-testid="z-close-header-button"]')).toBeNull();
  });

  it('has no axe violations while open', async () => {
    const fixture = await render<OverlayHost>(host);
    await openFromButton(fixture);

    const dialog = panel() as HTMLElement;
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(await axeViolations(document.body)).toEqual([]);
  });
});

describe('VmConfirmDialogService', () => {
  let opener: HTMLButtonElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: uiTestingImports, providers: uiTestingProviders });
    opener = document.createElement('button');
    opener.textContent = 'Löschen';
    document.body.appendChild(opener);
    opener.focus();
  });

  afterEach(() => {
    opener.remove();
    TestBed.resetTestingModule();
  });

  function confirm(zClosable?: boolean) {
    return TestBed.inject(VmConfirmDialogService).confirm({
      zTitle: 'Mappe löschen?',
      zDescription: 'Die Noten bleiben in der Bibliothek.',
      zOkText: 'Löschen',
      zCancelText: 'Abbrechen',
      zOkDestructive: true,
      zDuration: 0,
      zClosable,
    });
  }

  it('focuses the dialog and keeps the focus inside while tabbing', async () => {
    confirm();
    await settle();

    const dialog = panel('alertdialog') as HTMLElement;
    expect(dialog.contains(document.activeElement)).toBe(true);

    const [start, end] = focusTrapAnchors(dialog);
    end.focus();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('z-alert-cancel-button');
    start.focus();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('z-alert-ok-button');
  });

  it('closes on Escape and returns the focus', async () => {
    const ref = confirm();
    await settle();

    pressKey(document.activeElement ?? document.body, 'Escape');
    await settle();

    expect(ref.isClosing()).toBe(true);
    expect(panel('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('stays open on Escape when it is not closable', async () => {
    const ref = confirm(false);
    await settle();

    pressKey(document.activeElement ?? document.body, 'Escape');
    await settle();

    expect(ref.isClosing()).toBe(false);
    expect(panel('alertdialog')).not.toBeNull();
    ref.close();
    await settle();
  });

  it('has no axe violations while open', async () => {
    confirm();
    await settle();

    expect(await axeViolations(document.body)).toEqual([]);
  });
});
