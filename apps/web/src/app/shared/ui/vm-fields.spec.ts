import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { VmField, VmFieldError, VmFieldLabel, VmInput, VmSelect, VmTextarea } from '@vm-web/ui';

@Component({
  imports: [FormsModule, VmInput, VmTextarea, VmSelect],
  template: `
    <input vm-input name="title" [(ngModel)]="title" />
    <input vm-input type="number" name="count" [(ngModel)]="count" />
    <textarea vm-textarea name="note" [(ngModel)]="note"></textarea>
    <select vm-select name="choice" [(ngModel)]="choice">
      <option value="a">A</option>
      <option value="b">B</option>
    </select>
  `,
})
class Host {
  readonly title = signal('Marsch');
  readonly count = signal<number | null>(3);
  readonly note = signal('Hinweis');
  readonly choice = signal('b');
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
}

function type(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  element.value = value;
  element.dispatchEvent(new Event('input'));
}

describe('vm-input, vm-textarea und vm-select', () => {
  it('zeigen die Formularwerte', async () => {
    const { el } = await setup();
    const [title, count] = Array.from(el.querySelectorAll('input'));
    expect(title.value).toBe('Marsch');
    expect(count.value).toBe('3');
    expect(el.querySelector('textarea')?.value).toBe('Hinweis');
    expect(el.querySelector('select')?.value).toBe('b');
  });

  it('schreiben Eingaben zurück und behalten Zahlen als Zahl', async () => {
    const { el, host } = await setup();
    const [title, count] = Array.from(el.querySelectorAll('input'));
    type(title, 'Polka');
    type(count, '7');
    type(el.querySelector('textarea') as HTMLTextAreaElement, 'Neu');
    const select = el.querySelector('select') as HTMLSelectElement;
    select.value = 'a';
    select.dispatchEvent(new Event('change'));
    expect(host.title()).toBe('Polka');
    expect(host.count()).toBe(7);
    expect(host.note()).toBe('Neu');
    expect(host.choice()).toBe('a');
  });

  it('nutzen die M3-Feldform', async () => {
    const { el } = await setup();
    for (const field of Array.from(el.querySelectorAll('input, textarea, select'))) {
      expect(field.className).toContain('rounded-extra-small');
      expect(field.className).toContain('border-outline');
      expect(field.className).toContain('aria-invalid:border-error');
    }
  });
});

@Component({
  imports: [VmField, VmFieldLabel, VmFieldError, VmInput],
  template: `
    <label vm-field class="md:w-64">
      <span vm-field-label>Titel</span>
      <input vm-input />
      <span vm-field-error id="err">Pflichtfeld</span>
    </label>
  `,
})
class FieldHost {}

describe('vm-field', () => {
  it('stapelt Label, Feld und Fehler und behält eigene Klassen', async () => {
    const fixture = TestBed.createComponent(FieldHost);
    await fixture.whenStable();
    const label = (fixture.nativeElement as HTMLElement).querySelector('label');
    expect(label?.className).toContain('flex-col');
    expect(label?.className).toContain('md:w-64');
    expect(label?.querySelector('span[vm-field-label]')?.className).toContain('text-label-large');
  });

  it('zeigt Fehler mit Icon und Text', async () => {
    const fixture = TestBed.createComponent(FieldHost);
    await fixture.whenStable();
    const error = (fixture.nativeElement as HTMLElement).querySelector('#err');
    expect(error?.querySelector('ng-icon')).not.toBeNull();
    expect(error?.textContent).toContain('Pflichtfeld');
    expect(error?.className).toContain('text-error');
  });
});
