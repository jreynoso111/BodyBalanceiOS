const CSV_FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

export function neutralizeCsvFormula(value: unknown) {
  const normalized = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  if (!normalized) return '';
  return CSV_FORMULA_PREFIX_PATTERN.test(normalized) ? `'${normalized}` : normalized;
}

export function escapeCsvCell(value: unknown) {
  const sanitized = neutralizeCsvFormula(value).replace(/"/g, '""');
  return `"${sanitized}"`;
}
