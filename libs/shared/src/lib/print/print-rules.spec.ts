import { DEFAULT_PRINT_RULES, printModeFor, printRulesSchema } from './print-rules.schema';

describe('print rules (D-6)', () => {
  it('picks the rule for a page count', () => {
    const rules = [
      { fromPages: 1, mode: 'simplex' as const },
      { fromPages: 2, mode: 'duplex' as const },
      { fromPages: 6, mode: 'simplex' as const },
    ];
    expect([1, 2, 5, 6, 40].map((pages) => printModeFor(pages, rules))).toEqual(['simplex', 'duplex', 'duplex', 'simplex', 'simplex']);
    expect(printModeFor(1, DEFAULT_PRINT_RULES)).toBe('simplex');
    expect(printModeFor(3, DEFAULT_PRINT_RULES)).toBe('duplex');
  });

  it('accepts only complete, ascending rule sets', () => {
    expect(printRulesSchema.safeParse(DEFAULT_PRINT_RULES).success).toBe(true);
    expect(printRulesSchema.safeParse([{ fromPages: 2, mode: 'duplex' }]).success).toBe(false);
    expect(printRulesSchema.safeParse([{ fromPages: 1, mode: 'duplex' }, { fromPages: 1, mode: 'simplex' }]).success).toBe(false);
    expect(printRulesSchema.safeParse([]).success).toBe(false);
  });
});
