import { escapeCsvCell, neutralizeCsvFormula } from '@/services/csv';

describe('CSV safety', () => {
  it('neutralizes formula-like prefixes', () => {
    expect(neutralizeCsvFormula('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(neutralizeCsvFormula('+cmd')).toBe("'+cmd");
    expect(neutralizeCsvFormula('-42')).toBe("'-42");
    expect(neutralizeCsvFormula('@user')).toBe("'@user");
  });

  it('normalizes newlines and escapes quotes', () => {
    expect(escapeCsvCell('line 1\n"quoted"')).toBe('"line 1 ""quoted"""');
  });

  it('keeps regular values unchanged apart from csv quoting', () => {
    expect(escapeCsvCell('Alice')).toBe('"Alice"');
    expect(escapeCsvCell(25)).toBe('"25"');
  });
});
