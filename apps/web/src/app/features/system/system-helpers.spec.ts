import type { Permission } from '@vm-web/shared';

import { permissionKey, withDependencies } from './roles/permission-labels';
import { optionsFromText } from '../library/ui/field-draft';

describe('permission matrix', () => {
  const set = (...p: Permission[]) => new Set<Permission>(p);

  it('turns on view together with another action of the area', () => {
    expect([...withDependencies(set(), 'score.edit', true)].sort()).toEqual(['score.edit', 'score.view']);
  });

  it('removes all actions of the area when view is turned off', () => {
    const next = withDependencies(set('score.view', 'score.edit', 'folder.view'), 'score.view', false);
    expect([...next]).toEqual(['folder.view']);
  });

  it('adds config.view for config.edit, but nothing for upload', () => {
    expect([...withDependencies(set(), 'config.edit', true)].sort()).toEqual(['config.edit', 'config.view']);
    expect([...withDependencies(set(), 'sheet.upload', true)]).toEqual(['sheet.upload']);
  });

  it('builds i18n keys without dots in the code', () => {
    expect(permissionKey('sheet.upload')).toBe('system.permissions.codes.sheet_upload');
  });
});

describe('optionsFromText', () => {
  it('keeps ids of unchanged labels and drops empty lines and duplicates', () => {
    const existing = [{ id: 'a', label: 'Leicht' }];
    expect(optionsFromText('Leicht\n\n Schwer \nSchwer', existing)).toEqual([{ id: 'a', label: 'Leicht' }, { label: 'Schwer' }]);
  });
});
