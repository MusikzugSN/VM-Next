import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { VmInput, VmSelect, VmTextarea } from '@vm-web/ui';

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
