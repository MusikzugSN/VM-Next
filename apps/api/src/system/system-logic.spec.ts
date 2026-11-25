import { detectImage } from './config.service';
import { descendantsOf } from './ensembles.service';

describe('detectImage (S-4)', () => {
  it.each([
    ['png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), 'image/png'],
    ['jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), 'image/jpeg'],
    ['webp', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]), 'image/webp'],
    ['svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml'],
    ['svg with prolog', Buffer.from(String.fromCharCode(0xfeff) + '<?xml version="1.0"?>\n<!-- logo -->\n<!DOCTYPE svg PUBLIC "x" "y">\n<svg width="10">'), 'image/svg+xml'],
  ])('detects %s from the content', (_, bytes, mime) => {
    expect(detectImage(bytes)?.mime).toBe(mime);
  });

  it.each([
    ['pdf', Buffer.from('%PDF-1.7')],
    ['html', Buffer.from('<html><svg></svg></html>')],
    ['gif', Buffer.from('GIF89a')],
  ])('rejects %s', (_, bytes) => {
    expect(detectImage(bytes)).toBeNull();
  });

  it('stays fast on many comments (no ReDoS)', () => {
    const start = performance.now();
    expect(detectImage(Buffer.from('<!--' + '--><!--'.repeat(150)))).toBeNull();
    expect(detectImage(Buffer.from('<!-- a -->'.repeat(50) + '<svg>'))?.mime).toBe('image/svg+xml');
    expect(performance.now() - start).toBeLessThan(100);
  });

  it('rejects an unterminated comment and a non-svg doctype', () => {
    expect(detectImage(Buffer.from('<!-- <svg>'))).toBeNull();
    expect(detectImage(Buffer.from('<!DOCTYPE html><svg>'))).toBeNull();
  });
});

describe('descendantsOf (F-3)', () => {
  const tree = [
    { id: 'root', parentId: null },
    { id: 'a', parentId: 'root' },
    { id: 'a1', parentId: 'a' },
    { id: 'a1x', parentId: 'a1' },
    { id: 'b', parentId: 'root' },
  ];

  it('collects all descendants, not the ensemble itself', () => {
    expect([...descendantsOf('a', tree)].sort()).toEqual(['a1', 'a1x']);
    expect(descendantsOf('b', tree).size).toBe(0);
    expect(descendantsOf('root', tree).size).toBe(4);
  });
});
