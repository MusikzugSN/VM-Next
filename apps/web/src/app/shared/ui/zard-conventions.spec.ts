import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { VmButton, VmIconButton } from '@vm-web/ui';

function appRoot(): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, 'nx.json'))) dir = dirname(dir);
  return join(dir, 'apps/web/src/app');
}

function templates(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'components' && dir.endsWith('shared') ? [] : templates(path);
    return /\.(html|ts)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

@Component({
  imports: [VmButton, VmIconButton],
  template: `
    <button vm-button type="button" [zDisabled]="off()">Speichern</button>
    <a vm-button href="/x">Link</a>
    <button vm-icon-button variant="danger" type="button" aria-label="Löschen"></button>
  `,
})
class Host {
  readonly off = signal(true);
}

describe('vm-button in VM-Web', () => {
  it('disables a native button through zDisabled and keeps link semantics', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('role')).toBeNull();
    expect(el.querySelector('a')?.getAttribute('role')).toBeNull();

    fixture.componentInstance.off.set(false);
    await fixture.whenStable();
    expect(button.disabled).toBe(false);
  });

  it('maps the M3 variants to their color roles', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a')?.className).toContain('bg-primary');
    expect(el.querySelector('a')?.className).toContain('text-on-primary');
    const icon = el.querySelector('button[vm-icon-button]');
    expect(icon?.className).toContain('bg-error');
    expect(icon?.className).toContain('size-control');
  });

  it('shows a disabled button in the M3 disabled colors', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const cls = (fixture.nativeElement as HTMLElement).querySelector('button')?.className ?? '';
    expect(cls).toContain('bg-on-surface/12');
    expect(cls).toContain('text-on-surface/38');
    expect(cls).not.toContain('bg-primary');
  });

  it('is never disabled with [disabled] (the host binding would remove it)', () => {
    const root = appRoot();
    const offenders = templates(root).filter((file) =>
      [...readFileSync(file, 'utf8').matchAll(/<(button|a)\b[^>]*?\bvm-(?:icon-)?button\b[^>]*?>/gs)].some((m) => m[0].includes('[disabled]=')),
    );
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });
});

describe('Create, add and edit in VM-Web', () => {
  // Forms that pop up inside the page push the content around; they belong into a dialog
  // (`vm-form-dialog`, `vm-name-dialog`, …), which is full screen on phones.
  it('never shows an inline form behind a creating/renaming/adding/editing flag', () => {
    const root = appRoot();
    const pattern = /@if \(\s*(creating|renaming|adding|editing|addingField|creatingTag)\w*\(\)/;
    const offenders = templates(root).filter((file) => pattern.test(readFileSync(file, 'utf8')));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });
});
