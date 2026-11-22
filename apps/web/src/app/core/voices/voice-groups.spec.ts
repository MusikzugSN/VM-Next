import { isStandIn } from './voice-groups';

describe('isStandIn (M-2)', () => {
  const horn = { id: 'horn' };
  const trumpet = { id: 'trumpet' };

  it('is false for the profile voices or a subset of them', () => {
    expect(isStandIn([horn, trumpet], [horn, trumpet])).toBe(false);
    expect(isStandIn([horn], [horn, trumpet])).toBe(false);
  });

  it('is true as soon as an active voice is not an own voice', () => {
    expect(isStandIn([trumpet], [horn])).toBe(true);
    expect(isStandIn([horn, trumpet], [horn])).toBe(true);
  });
});
