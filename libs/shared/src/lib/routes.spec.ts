import { API_ROUTES, apiUrl } from './routes';
import { cursorQuerySchema } from './common/pagination.schema';
import { voiceContextQuerySchema } from './common/voice.schema';
import { printQuerySchema } from './print/print-plan.schema';

const ID = '0193f2a4-5b6c-7d8e-9f01-23456789abcd';

describe('routes', () => {
  it('builds absolute paths with encoded parameters', () => {
    expect(apiUrl('me', 'folderScores', { folderId: ID })).toBe(`/internal/v1/me/folders/${ID}/scores`);
    expect(apiUrl('review', 'approve', { uploadId: ID })).toBe(`/internal/v1/review/uploads/${ID}/approve`);
  });

  it('throws on missing parameters', () => {
    expect(() => apiUrl('me', 'folderScores')).toThrow(/folderId/);
  });

  it('has no duplicate method + path per feature', () => {
    for (const group of Object.values(API_ROUTES)) {
      const keys = Object.entries(group)
        .filter(([name]) => name !== 'base')
        .map(([, def]) => {
          const d = def as { method: string; path: string };
          return `${d.method} ${d.path}`;
        });
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('uses only GET for reads and POST for actions', () => {
    for (const group of Object.values(API_ROUTES)) {
      for (const [name, def] of Object.entries(group)) {
        if (name === 'base') continue;
        expect(['GET', 'POST']).toContain((def as { method: string }).method);
      }
    }
  });
});

describe('common query schemas', () => {
  it('applies pagination defaults and limits', () => {
    expect(cursorQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(cursorQuerySchema.safeParse({ limit: '201' }).success).toBe(false);
  });

  it('accepts single and repeated voiceId', () => {
    expect(voiceContextQuerySchema.parse({ voiceId: ID }).voiceId).toEqual([ID]);
    expect(voiceContextQuerySchema.parse({ voiceId: [ID, ID] }).voiceId).toHaveLength(2);
    expect(voiceContextQuerySchema.parse({}).voiceId).toEqual([]);
  });

  it('requires the id matching the print scope', () => {
    expect(printQuerySchema.safeParse({ scope: 'folder' }).success).toBe(false);
    // Duplex is no longer chosen per job; the ensemble's print rules decide (D-6).
    expect(printQuerySchema.parse({ scope: 'folder', folderId: ID })).toMatchObject({ scope: 'folder', folderId: ID, substitutes: 'fallback' });
  });
});
