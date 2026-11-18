import { inTreeOrder } from './ensemble-tree';

const tree = [
  { id: 'root', name: 'Verein', parentId: null },
  { id: 'jugend', name: 'Jugendorchester', parentId: 'root' },
  { id: 'haupt', name: 'Hauptorchester', parentId: 'root' },
  { id: 'brass', name: 'Brass-Ensemble', parentId: 'haupt' },
];

describe('inTreeOrder', () => {
  it('lists parents before children and siblings by name, with depth', () => {
    expect(inTreeOrder(tree, () => true)).toEqual([
      { id: 'root', name: 'Verein', depth: 0 },
      { id: 'haupt', name: 'Hauptorchester', depth: 1 },
      { id: 'brass', name: 'Brass-Ensemble', depth: 2 },
      { id: 'jugend', name: 'Jugendorchester', depth: 1 },
    ]);
  });

  it('counts only shown ancestors, so a selection without the root starts at 0', () => {
    expect(inTreeOrder(tree, (n) => n.id !== 'root')).toEqual([
      { id: 'haupt', name: 'Hauptorchester', depth: 0 },
      { id: 'brass', name: 'Brass-Ensemble', depth: 1 },
      { id: 'jugend', name: 'Jugendorchester', depth: 0 },
    ]);
  });
});
