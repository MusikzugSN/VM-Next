import type { Permission } from '@vm-web/shared';

import { initials } from '../branding/branding.store';
import { canSee, isActive, MOBILE_NAV, NAV_SECTIONS } from './nav';

describe('navigation', () => {
  const visible = (isMember: boolean, permissions: Permission[]) =>
    NAV_SECTIONS.flatMap((s) => s.items)
      .filter((item) => canSee(item.access, { isMember, can: (p) => permissions.includes(p) }))
      .map((item) => item.path);

  it('shows a musician only Mein Bereich and Drucken', () => {
    expect(visible(true, ['sheet.upload'])).toEqual(['/me', '/me/folders', '/me/events', '/me/tags', '/me/uploads', '/me/profile', '/print']);
  });

  it('shows the library to librarians and the settings for their custom fields', () => {
    const paths = visible(true, ['score.view', 'score.edit', 'sheet.approve', 'folder.view', 'event.view', 'tag.view', 'voice.view']);
    expect(paths).toContain('/library/review');
    expect(paths).toContain('/system/settings');
    expect(paths).not.toContain('/system/users');
  });

  it('keeps the list entry active on its detail pages', () => {
    const all = NAV_SECTIONS.flatMap((s) => s.items);
    const item = (path: string) => all.find((i) => i.path === path) ?? all[0];
    expect(isActive(item('/library/folders'), '/library/folders/abc?tab=x')).toBe(true);
    expect(isActive(item('/me'), '/me/folders')).toBe(false);
    expect(isActive(item('/me'), '/me/scores/abc')).toBe(true);
    expect(isActive(item('/me/tags'), '/me/tags/club/abc')).toBe(true);
    expect(isActive(item('/library/scores'), '/library/scores-x')).toBe(false);
  });

  it('has the four phone destinations of the Design Guideline', () => {
    expect(MOBILE_NAV.map((item) => item.path)).toEqual(['/me', '/me/folders', '/me/events', '/me/profile']);
  });
});

describe('initials', () => {
  it.each([
    ['Musikzug Musterstadt', 'MM'],
    ['Lena Maier', 'LM'],
    ['Stadtkapelle Bad-Waldsee', 'SW'],
    ['VM-Web', 'VW'],
    ['Ötzi', 'ÖT'],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
