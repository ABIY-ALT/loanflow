import type { LoanRequest } from '@/types/loan';

/** Normalize amounts so 400000 and 400000.00 share one case identity. */
export function normalizeLoanAmount(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value ?? '').trim();
}

/**
 * Canonical identity for one customer application (Head Office or District).
 * Intentionally excludes submissionType so the same case never appears twice by channel.
 */
export function buildCanonicalCaseFingerprint(input: {
  customerId: string;
  loanAmount: unknown;
  sectorId: string;
  requestTypeId: string;
  loanPurpose?: string | null;
}): string {
  return [
    input.customerId,
    normalizeLoanAmount(input.loanAmount),
    input.sectorId,
    input.requestTypeId,
    String(input.loanPurpose ?? '').trim().toLowerCase(),
  ].join('|');
}

/** @deprecated Use buildCanonicalCaseFingerprint for dedupe; kept for logging/tools. */
export function buildLoanSubmissionFingerprint(input: {
  customerId: string;
  loanAmount: number | string;
  sectorId: string;
  requestTypeId: string;
  loanPurpose?: string | null;
  submissionType?: string | null;
}): string {
  const base = buildCanonicalCaseFingerprint(input);
  return `${base}|${input.submissionType || 'TYPE1'}`;
}

export function buildLoanSubmissionFingerprintFromLoan(loan: Pick<
  LoanRequest,
  'customerId' | 'loanAmount' | 'sectorId' | 'requestTypeId' | 'loanPurpose'
>): string {
  return buildCanonicalCaseFingerprint({
    customerId: loan.customerId,
    loanAmount: loan.loanAmount,
    sectorId: loan.sectorId,
    requestTypeId: loan.requestTypeId,
    loanPurpose: loan.loanPurpose,
  });
}

export type LoanRowForDedup = {
  customerId: string;
  loanAmount: unknown;
  sectorId: string;
  requestTypeId: string;
  loanPurpose: string;
  submissionType?: string | null;
  lastUpdatedDate: Date | string;
  workflowVersionId?: string | null;
  currentStageId?: string | null;
  isTerminalStage?: boolean;
};

/** Prefer active workflow-linked case, then most recently updated. */
export function canonicalSubmissionScore(row: LoanRowForDedup): number {
  const updated = new Date(row.lastUpdatedDate).getTime();
  let score = updated;
  if (!row.isTerminalStage) score += 2e16;
  if (row.workflowVersionId) score += 1e15;
  if (row.currentStageId) score += 1e14;
  return score;
}

/** One visible case per canonical application (no time limit, any submission channel). */
export function dedupeLoanRowsBySubmission<T extends LoanRowForDedup>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const fingerprint = buildCanonicalCaseFingerprint({
      customerId: row.customerId,
      loanAmount: row.loanAmount,
      sectorId: row.sectorId,
      requestTypeId: row.requestTypeId,
      loanPurpose: row.loanPurpose,
    });
    const existing = best.get(fingerprint);
    if (!existing || canonicalSubmissionScore(row) > canonicalSubmissionScore(existing)) {
      best.set(fingerprint, row);
    }
  }
  return Array.from(best.values());
}

export function dedupeOrderedLoanRows<T extends LoanRowForDedup>(customerId: string, rows: T[]): T[] {
  return dedupeLoanRowsBySubmission(
    rows.map((row) => ({ ...row, customerId: row.customerId || customerId })),
  );
}

export function dedupeLoansBySubmission<T extends LoanRequest>(loans: T[]): T[] {
  return dedupeLoanRowsBySubmission(loans) as T[];
}
