import { ALL_PERMISSIONS } from '@vm-web/shared';
import { join } from 'node:path';
import { expandPermissions, loadDefaultRoles, parseDefaultRoles } from './default-roles';

describe('default roles', () => {
  it('expands * and area.* and keeps a stable order', () => {
    expect(expandPermissions(['*'])).toEqual(ALL_PERMISSIONS);
    expect(expandPermissions(['member.view', 'folder.*'])).toEqual([
      'folder.view',
      'folder.create',
      'folder.edit',
      'folder.delete',
      'member.view',
    ]);
  });

  it('rejects unknown codes and areas', () => {
    expect(() => expandPermissions(['folder.publish'])).toThrow(/Unknown permission "folder.publish"/);
    expect(() => expandPermissions(['music.*'])).toThrow(/Unknown permission area/);
  });

  it('requires the admin role and unique keys', () => {
    expect(() => parseDefaultRoles({ version: 1, roles: [{ key: 'musician', name: 'M', permissions: [] }] })).toThrow(/admin/);
    expect(() =>
      parseDefaultRoles({
        version: 1,
        roles: [
          { key: 'admin', name: 'A', permissions: ['*'] },
          { key: 'admin', name: 'B', permissions: [] },
        ],
      }),
    ).toThrow(/Duplicate/);
  });

  it('loads the shipped file (R-5, F-2, F-3)', async () => {
    const { roles } = await loadDefaultRoles(join(__dirname, '../../defaults/roles.default.json'));
    const byKey = Object.fromEntries(roles.map((r) => [r.key, r.permissions]));
    expect(Object.keys(byKey)).toEqual(['admin', 'musician', 'librarian', 'board']);
    expect(byKey['admin']).toEqual(ALL_PERMISSIONS);
    expect(byKey['musician']).toEqual(['sheet.upload']);
    expect(byKey['librarian']).toEqual(expect.arrayContaining(['score.delete', 'sheet.approve', 'sheet.upload', 'member.view']));
    expect(byKey['librarian']).not.toContain('user.view');
    expect(byKey['board']).toEqual(['event.view', 'event.create', 'event.edit', 'event.delete', 'member.view']);
  });
});
