export type AdjustmentRequestPayload = {
  mode?: 'set_total' | 'reduce_by';
  proposed_total?: number | null;
  amount_delta?: number | null;
  currency?: string | null;
  reason?: string | null;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  if (!normalized) return null;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getAdjustmentPayload(value: unknown): AdjustmentRequestPayload | null {
  const candidate = asObject(value);
  if (!candidate) return null;

  const mode = candidate.mode === 'reduce_by' ? 'reduce_by' : 'set_total';

  return {
    mode,
    proposed_total: parseNumericValue(candidate.proposed_total),
    amount_delta: parseNumericValue(candidate.amount_delta),
    currency: typeof candidate.currency === 'string' ? candidate.currency : null,
    reason: typeof candidate.reason === 'string' ? candidate.reason : null,
  };
}

function getLegacySetTotal(message?: string | null): number | null {
  if (!message) return null;

  const updateMatch = /shared total to\s+([^.]*)/i.exec(message);
  if (!updateMatch?.[1]) return null;
  return parseNumericValue(updateMatch[1]);
}

function getLegacyReductionAmount(message?: string | null): number | null {
  if (!message) return null;

  const reductionMatch = /reduction of\s+([^.]*)/i.exec(message);
  if (!reductionMatch?.[1]) return null;
  return parseNumericValue(reductionMatch[1]);
}

export function getRequestedLoanAmount(options: {
  currentAmount: number;
  requestPayload?: unknown;
  message?: string | null;
}) {
  const payload = getAdjustmentPayload(options.requestPayload);
  if (payload?.mode === 'set_total' && Number.isFinite(payload.proposed_total)) {
    return payload.proposed_total as number;
  }

  if (payload?.mode === 'reduce_by' && Number.isFinite(payload.amount_delta)) {
    return Math.max(options.currentAmount - (payload.amount_delta as number), 0);
  }

  const legacySetTotal = getLegacySetTotal(options.message);
  if (Number.isFinite(legacySetTotal)) {
    return legacySetTotal as number;
  }

  const legacyReduction = getLegacyReductionAmount(options.message);
  if (Number.isFinite(legacyReduction)) {
    return Math.max(options.currentAmount - (legacyReduction as number), 0);
  }

  return null;
}
