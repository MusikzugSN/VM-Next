import type { SessionStore } from '../../../core/auth/session.store';
import { ensemblesWith } from './ensembles-with';

const ensemble = (id: string) => ({ ensemble: { id, name: id } });

describe('ensemblesWith', () => {
  it('keeps the ensembles with the permission, in order', () => {
    const session = {
      access: () => ({ permissions: { ensembles: [ensemble('a'), ensemble('b'), ensemble('c')] } }),
      can: (_: string, id: string) => id !== 'b',
    } as unknown as SessionStore;

    expect(ensemblesWith(session, 'folder.view').map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('is empty without a session', () => {
    const session = { access: () => null, can: () => true } as unknown as SessionStore;
    expect(ensemblesWith(session, 'event.view')).toEqual([]);
  });
});
