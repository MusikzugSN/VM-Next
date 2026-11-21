import { matchKey, parseBoolean, parseDate, parseDuration, parseLabels, parseLink, parseNumber, parseText } from './score-import-values';

describe('CSV import values (N-19)', () => {
  it('trims text, treats blanks as empty and checks the length', () => {
    expect(parseText('  Martin Scharnagl ', 200)).toEqual({ value: 'Martin Scharnagl' });
    expect(parseText('   ', 200)).toEqual({ value: null });
    expect(parseText(undefined, 200)).toEqual({ value: null });
    expect(parseText('x'.repeat(201), 200)).toEqual({ code: 'too_big' });
  });

  it('parses numbers with comma or dot', () => {
    expect(parseNumber('1,5')).toEqual({ value: 1.5 });
    expect(parseNumber('1.5')).toEqual({ value: 1.5 });
    expect(parseNumber('1.234,5')).toEqual({ value: 1234.5 });
    expect(parseNumber('-3')).toEqual({ value: -3 });
    expect(parseNumber('')).toEqual({ value: null });
    expect(parseNumber('drei')).toEqual({ code: 'invalid_number' });
  });

  it('parses yes/no values', () => {
    for (const yes of ['true', 'Ja', 'x', '1', 'TRUE']) expect(parseBoolean(yes)).toEqual({ value: true });
    for (const no of ['false', 'Nein', '0']) expect(parseBoolean(no)).toEqual({ value: false });
    expect(parseBoolean('')).toEqual({ value: null });
    expect(parseBoolean('vielleicht')).toEqual({ code: 'invalid_boolean' });
  });

  it('parses German and ISO dates and rejects impossible ones', () => {
    expect(parseDate('6.7.2024')).toEqual({ value: '2024-07-06' });
    expect(parseDate('2024-07-06')).toEqual({ value: '2024-07-06' });
    expect(parseDate('31.02.2024')).toEqual({ code: 'invalid_date' });
    expect(parseDate('07/06/2024')).toEqual({ code: 'invalid_date' });
  });

  it('parses durations as m:ss, h:mm:ss or seconds', () => {
    expect(parseDuration('3:30')).toEqual({ value: 210 });
    expect(parseDuration('1:02:03')).toEqual({ value: 3723 });
    expect(parseDuration('95')).toEqual({ value: 95 });
    expect(parseDuration('3:75')).toEqual({ code: 'invalid_duration' });
    expect(parseDuration('lang')).toEqual({ code: 'invalid_duration' });
  });

  it('accepts only http(s) links', () => {
    expect(parseLink('https://example.org/x')).toEqual({ value: 'https://example.org/x' });
    expect(parseLink('ftp://example.org')).toEqual({ code: 'invalid_link' });
    expect(parseLink('keine url')).toEqual({ code: 'invalid_link' });
  });

  it('splits multiselect labels and removes duplicates', () => {
    expect(parseLabels(' Marsch ', false)).toEqual(['Marsch']);
    expect(parseLabels('Polka, Marsch;polka,,', true)).toEqual(['Polka', 'Marsch']);
    expect(parseLabels('', true)).toEqual([]);
  });

  it('matches titles case-insensitively with collapsed whitespace', () => {
    expect(matchKey('  Schönfeld-Marsch ')).toBe(matchKey('schönfeld-marsch'));
    expect(matchKey('O du  mein Österreich')).toBe('o du mein österreich');
  });
});
