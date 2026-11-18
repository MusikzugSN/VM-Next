import type { SessionPermissions } from '@vm-web/shared';

import { hasPermission, isMember, type Access } from './permissions';

const ref = (id: string) => ({ id, name: id });

function access(permissions: Partial<SessionPermissions>, isAdmin = false): Access {
  return {
    isAdmin,
    permissions: { club: [], anyEnsemble: [], memberships: [], ensembles: [], ...permissions },
  };
}

describe('hasPermission', () => {
  it('lets admins do everything', () => {
    expect(hasPermission(access({}, true), 'config.edit')).toBe(true);
    expect(hasPermission(access({}, true), 'folder.edit', 'e1')).toBe(true);
  });

  it('checks club permissions against the club list (F-1)', () => {
    expect(hasPermission(access({ club: ['user.view'] }), 'user.view')).toBe(true);
    expect(hasPermission(access({ anyEnsemble: ['user.view'] }), 'user.view')).toBe(false);
  });

  it('checks any-ensemble permissions against at least one ensemble (R-4)', () => {
    expect(hasPermission(access({ anyEnsemble: ['score.view'] }), 'score.view')).toBe(true);
    expect(hasPermission(access({ anyEnsemble: [] }), 'sheet.approve')).toBe(false);
  });

  it('checks ensemble permissions per ensemble, or in any ensemble without id', () => {
    const a = access({
      anyEnsemble: ['folder.edit'],
      ensembles: [
        { ensemble: ref('e1'), permissions: ['folder.edit'] },
        { ensemble: ref('e2'), permissions: ['folder.view'] },
      ],
    });
    expect(hasPermission(a, 'folder.edit', 'e1')).toBe(true);
    expect(hasPermission(a, 'folder.edit', 'e2')).toBe(false);
    expect(hasPermission(a, 'folder.edit', 'unknown')).toBe(false);
    expect(hasPermission(a, 'folder.edit')).toBe(true);
  });
});

describe('isMember', () => {
  it('needs a membership or the admin flag (R-2)', () => {
    expect(isMember(access({}))).toBe(false);
    expect(isMember(access({ memberships: [{ ensemble: ref('e1'), role: ref('r1') }] }))).toBe(true);
    expect(isMember(access({}, true))).toBe(true);
  });
});
