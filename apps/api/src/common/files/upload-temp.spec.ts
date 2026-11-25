import { join } from 'node:path';
import { UPLOAD_TEMP_DIR, uploadTempPath } from './upload-temp';

describe('uploadTempPath', () => {
  it('accepts multer temp files', () => {
    expect(uploadTempPath(join(UPLOAD_TEMP_DIR, 'abc123'))).toBe(join(UPLOAD_TEMP_DIR, 'abc123'));
  });

  it.each([
    ['outside', join(UPLOAD_TEMP_DIR, '..', 'etc-passwd')],
    ['the directory itself', UPLOAD_TEMP_DIR],
    ['a sibling with the same prefix', UPLOAD_TEMP_DIR + '-evil/x'],
  ])('rejects %s', (_, path) => {
    expect(() => uploadTempPath(path)).toThrow();
  });
});
