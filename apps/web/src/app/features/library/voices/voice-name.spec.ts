import { instrumentFromVoiceName } from './voice-name';

const instruments = ['Klarinette', 'Saxophon', 'Horn', 'Flügelhorn', 'Tenorhorn'];

describe('instrumentFromVoiceName', () => {
  it('finds the existing instrument in the voice name', () => {
    expect(instrumentFromVoiceName('Klarinette 3 in B', instruments)).toBe('Klarinette');
    expect(instrumentFromVoiceName('Altsaxophon 1 in Es', instruments)).toBe('Saxophon');
  });

  it('prefers the longest match', () => {
    expect(instrumentFromVoiceName('Flügelhorn 2 in B', instruments)).toBe('Flügelhorn');
    expect(instrumentFromVoiceName('Horn 1 in F', instruments)).toBe('Horn');
  });

  it('derives a new instrument from part number and key', () => {
    expect(instrumentFromVoiceName('Bassposaune 2 in C', instruments)).toBe('Bassposaune');
    expect(instrumentFromVoiceName('Piccolo', instruments)).toBe('Piccolo');
    expect(instrumentFromVoiceName('Trompete II', instruments)).toBe('Trompete');
    expect(instrumentFromVoiceName('  ', instruments)).toBe('');
  });
});
