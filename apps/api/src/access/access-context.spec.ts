import { ALL_PERMISSIONS } from '@vm-web/shared';
import { accessOf, ENS } from '../testing/access-fixtures';

describe('AccessContext', () => {
  it('applies a role in its ensemble and all descendants, not in siblings (F-3)', () => {
    const access = accessOf('orchestraLibrarian');
    expect(access.has('folder.edit', ENS.orchestra)).toBe(true);
    expect(access.has('folder.edit', ENS.windClass)).toBe(true);
    expect(access.has('folder.edit', ENS.youth)).toBe(false);
    expect(access.has('folder.edit', ENS.root)).toBe(false);
  });

  it('applies a role at the root everywhere', () => {
    const access = accessOf('rootLibrarian');
    for (const id of Object.values(ENS)) expect(access.has('event.create', id)).toBe(true);
  });

  it('needs an ensemble for ensemble-scoped permissions', () => {
    expect(accessOf('orchestraLibrarian').has('folder.view')).toBe(false);
  });

  it('grants any-ensemble permissions if held in one ensemble (R-4)', () => {
    expect(accessOf('orchestraLibrarian').has('score.edit')).toBe(true);
    expect(accessOf('youthBoard').has('score.view')).toBe(false);
    expect(accessOf('musician').has('sheet.upload')).toBe(true);
    expect(accessOf('musician').has('sheet.approve')).toBe(false);
  });

  it('makes club permissions of a role effective club-wide, wherever the role is held (F-1)', () => {
    const access = accessOf('youthAdminRole');
    expect(access.has('user.edit')).toBe(true);
    expect(access.has('config.edit')).toBe(true);
    expect([...access.club]).toContain('role.edit');
    // ensemble permissions of that role stay in the youth branch
    expect(access.has('folder.edit', ENS.youth)).toBe(true);
    expect(access.has('folder.edit', ENS.orchestra)).toBe(false);
  });

  it('does not give club permissions without a role containing them', () => {
    expect(accessOf('orchestraLibrarian').has('user.view')).toBe(false);
    expect(accessOf('orchestraLibrarian').club.size).toBe(0);
  });

  it('lets the admin flag do everything (R-6)', () => {
    const access = accessOf('adminFlag');
    for (const p of ALL_PERMISSIONS) {
      expect(access.has(p, ENS.youth)).toBe(true);
    }
  });

  it('lists ensembles with a permission, incl. inherited ones', () => {
    expect(accessOf('orchestraLibrarian').ensemblesWith('folder.view').sort()).toEqual([ENS.orchestra, ENS.windClass].sort());
    expect(accessOf('youthBoard').ensemblesWith('folder.view')).toEqual([]);
    expect(accessOf('adminFlag').ensemblesWith('folder.view')).toHaveLength(4);
  });

  it('scopes Mein Bereich to memberships and their descendants (R-2, H-1)', () => {
    expect(accessOf('musician').memberEnsembleIds().sort()).toEqual([ENS.orchestra, ENS.windClass].sort());
    // members of a role without permissions are still members
    expect(accessOf('plainMember').memberEnsembleIds()).toEqual([ENS.youth]);
    // the admin flag alone is no membership
    expect(accessOf('adminFlag').memberEnsembleIds()).toEqual([]);
    expect(accessOf('noMembership').memberEnsembleIds()).toEqual([]);
  });
});
