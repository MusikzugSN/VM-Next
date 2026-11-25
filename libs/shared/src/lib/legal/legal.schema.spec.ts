import { legalAddressSchema, phoneSchema, publicLegalDocumentResponseSchema, streetSchema } from './legal.schema';

describe('legal schemas (S-7)', () => {
  it.each(['Postfach 12 34', 'Postfach1234', 'postf. 12', 'PF 1234', 'PF', 'Pf. 99', 'P.O. Box 12', 'Hauptstr. 1, Postfach 7'])(
    'rejects PO box "%s"',
    (street) => {
      expect(streetSchema.safeParse(street).success).toBe(false);
    },
  );

  it.each(['Hauptstraße 12', 'Pfarrgasse 3', 'Am Pfahl 2', 'Pforzheimer Str. 5a', 'Alt-Moabit 59-61'])(
    'accepts street "%s"',
    (street) => {
      expect(streetSchema.safeParse(street).success).toBe(true);
    },
  );

  it('allows an empty address while editing but checks given values', () => {
    expect(legalAddressSchema.safeParse({ street: null, postalCode: null, city: null }).success).toBe(true);
    expect(legalAddressSchema.safeParse({ street: null, postalCode: '1234', city: null }).success).toBe(false);
  });

  it('checks phone numbers', () => {
    expect(phoneSchema.safeParse('+49 7131 123456').success).toBe(true);
    expect(phoneSchema.safeParse('07131/12 34 56').success).toBe(true);
    expect(phoneSchema.safeParse('12').success).toBe(false);
    expect(phoneSchema.safeParse('<b>0711</b>').success).toBe(false);
  });

  it('discriminates the public response by mode', () => {
    expect(publicLegalDocumentResponseSchema.parse({ mode: 'unavailable' })).toEqual({ mode: 'unavailable' });
    expect(publicLegalDocumentResponseSchema.safeParse({ mode: 'link' }).success).toBe(false);
  });
});
