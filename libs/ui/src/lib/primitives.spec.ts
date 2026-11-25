import { Component, signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrash2 } from '@ng-icons/lucide';

import { axeViolations, uiTestingImports, uiTestingProviders, wait } from '../testing/ui-testing';
import { VmBadge, VmBadgeCount } from './badge/vm-badge';
import { VmButton, VmIconButton } from './button/vm-button';
import { VmCard } from './card/vm-card';
import { VmField, VmFieldError, VmFieldLabel, VmInput, VmSelect, VmTextarea } from './field/vm-field';
import { VmCheckbox, VmSwitch } from './switch/vm-switch';
import { VmTable } from './table/vm-table';

@Component({
  imports: [VmButton],
  template: `
    <button type="button" vm-button>Speichern</button>
    <button type="button" vm-button variant="outlined" [zDisabled]="true">Gesperrt</button>
    <button type="button" vm-button variant="text" [zLoading]="true">Lädt</button>
    <a vm-button variant="tonal" href="/noten">Zu den Noten</a>
    <a vm-button variant="danger" href="/weg" [zDisabled]="true">Gesperrter Link</a>
  `,
})
class ButtonHost {}

@Component({
  imports: [VmIconButton, NgIcon, VmBadgeCount],
  viewProviders: [provideIcons({ lucideTrash2 })],
  template: `
    <button type="button" vm-icon-button aria-label="Löschen"><ng-icon name="lucideTrash2" aria-hidden="true" /></button>
    <button type="button" vm-icon-button variant="filled" aria-label="Filter" class="relative">
      <ng-icon name="lucideTrash2" aria-hidden="true" />
      <span vm-badge-count>3</span>
    </button>
    <a vm-icon-button href="/papierkorb" aria-label="Papierkorb" [zDisabled]="true"><ng-icon name="lucideTrash2" aria-hidden="true" /></a>
  `,
})
class IconButtonHost {}

@Component({
  imports: [FormsModule, VmField, VmFieldLabel, VmFieldError, VmInput, VmSelect, VmTextarea],
  template: `
    <label vm-field>
      <span vm-field-label>Titel</span>
      <input vm-input [(ngModel)]="title" aria-invalid="true" aria-describedby="title-error" />
      <span vm-field-error id="title-error">Bitte gib einen Titel ein.</span>
    </label>
    <label vm-field>
      <span vm-field-label>Stimme</span>
      <select vm-select [(ngModel)]="voice">
        <option value="">Keine</option>
        <option value="t1">Trompete 1</option>
        <option value="t2">Trompete 2</option>
      </select>
    </label>
    <label vm-field>
      <span vm-field-label>Notiz</span>
      <textarea vm-textarea [(ngModel)]="note"></textarea>
    </label>
  `,
})
class FieldHost {
  readonly title = signal('');
  readonly voice = signal('');
  readonly note = signal('');
}

@Component({
  imports: [VmCard, VmBadge],
  template: `
    <article vm-card>
      <h2>Marschmappe</h2>
      <span vm-badge tone="success">Vollständig</span>
    </article>
    <a vm-card variant="filled" href="/mappen/1">Konzertmappe <span vm-badge tone="warning">18/24</span></a>
    <section vm-card variant="elevated" aria-label="Hinweis">
      @for (tone of tones; track tone) {
        <span vm-badge [tone]="tone">{{ tone }}</span>
      }
    </section>
  `,
})
class CardHost {
  readonly tones = ['neutral', 'primary', 'tertiary', 'error', 'success', 'warning'] as const;
}

@Component({
  imports: [VmCheckbox, VmSwitch],
  template: `
    <label><input type="checkbox" vm-checkbox checked /> In Mein Bereich anzeigen</label>
    <label><input type="checkbox" vm-checkbox disabled /> Gesperrt</label>
    <vm-switch [checked]="on()" label="Benachrichtigungen" (toggled)="on.set($event)" />
    <vm-switch [checked]="false" label="Gesperrt" [disabled]="true" />
  `,
})
class SelectionHost {
  readonly on = signal(false);
}

@Component({
  imports: [VmTable],
  template: `
    <table vm-table>
      <caption>Druckaufträge</caption>
      <thead>
        <tr><th scope="col">Mappe</th><th scope="col">Seiten</th></tr>
      </thead>
      <tbody>
        <tr><td>Marschmappe</td><td>34</td></tr>
        <tr class="bg-primary-soft"><td>Konzertmappe</td><td>12</td></tr>
      </tbody>
    </table>
  `,
})
class TableHost {}

async function render<T>(host: Type<T>) {
  TestBed.configureTestingModule({ imports: [host, ...uiTestingImports], providers: uiTestingProviders });
  const fixture = TestBed.createComponent(host);
  await fixture.whenStable();
  await wait();
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('libs/ui primitives', () => {
  afterEach(() => TestBed.resetTestingModule());

  it.each([
    ['VmButton', ButtonHost],
    ['VmIconButton und VmBadgeCount', IconButtonHost],
    ['VmField, VmInput, VmSelect, VmTextarea', FieldHost],
    ['VmCard und VmBadge', CardHost],
    ['VmCheckbox und VmSwitch', SelectionHost],
    ['VmTable', TableHost],
  ] as const)('%s has no axe violations', async (_, host) => {
    const { el } = await render<unknown>(host);
    expect(await axeViolations(el)).toEqual([]);
  });

  it('VmButton disables through zDisabled, also for links', async () => {
    const { el } = await render(ButtonHost);
    const [, locked] = [...el.querySelectorAll('button')];
    const lockedLink = el.querySelector('a[href="/weg"]') as HTMLAnchorElement;

    expect(locked.disabled).toBe(true);
    expect(locked.getAttribute('aria-disabled')).toBe('true');
    expect(lockedLink.hasAttribute('disabled')).toBe(false);
    expect(lockedLink.getAttribute('aria-disabled')).toBe('true');

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    lockedLink.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
  });

  it('VmSwitch reports its state and toggles from the keyboard-reachable button', async () => {
    const { el, fixture } = await render(SelectionHost);
    const [toggle, locked] = [...el.querySelectorAll<HTMLButtonElement>('button[role="switch"]')];

    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Benachrichtigungen');
    expect(locked.disabled).toBe(true);

    toggle.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.on()).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('VmSelect stays a native, focusable select bound to the form', async () => {
    const { el, fixture } = await render(FieldHost);
    const select = el.querySelector('select') as HTMLSelectElement;

    expect(select.tabIndex).toBe(0);
    expect(select.hasAttribute('role')).toBe(false);

    select.focus();
    expect(document.activeElement).toBe(select);

    select.value = 't2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(fixture.componentInstance.voice()).toBe('t2');
  });
});
