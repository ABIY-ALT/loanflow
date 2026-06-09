/**
 * Insert-time duplicate prevention for loan submissions.
 * Used by loan-service-prisma and verification scripts.
 */
import type { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { normalizeEthiopianPhone } from '@/lib/utils';
import {
  buildCanonicalCaseFingerprint,
  normalizeLoanAmount,
} from '@/lib/loan-submission-fingerprint';

export function normalizeSubmissionText(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizeSubmissionEmail(value: unknown): string {
  return normalizeSubmissionText(value).toLowerCase();
}

export function generateUniqueLoanNumber(prefix: string): string {
  // Pattern: PREFIX-RANDOM_6_DIGITS (e.g. LN-T2-738974)
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${randomNum}`;
}

/** Advisory-lock payload: same application fields (any channel / user). */
export function buildSubmissionLockFingerprint(loanData: any): string {
  return JSON.stringify({
    customerEmail: normalizeSubmissionEmail(loanData.customerEmail),
    loanAmount: normalizeLoanAmount(loanData.loanAmount),
    sectorId: normalizeSubmissionText(loanData.sectorId),
    requestTypeId: normalizeSubmissionText(loanData.requestTypeId),
    loanPurpose: normalizeSubmissionText(loanData.loanPurpose).toLowerCase(),
  });
}

/** Permanent DB dedup key (no hourly bucket). */
export function buildPermanentSubmissionDedupKey(customerId: string, loanData: any): string {
  const fingerprint = buildCanonicalCaseFingerprint({
    customerId,
    loanAmount: loanData.loanAmount,
    sectorId: loanData.sectorId,
    requestTypeId: loanData.requestTypeId,
    loanPurpose: normalizeSubmissionText(loanData.loanPurpose),
  });
  return createHash('sha256').update(fingerprint).digest('hex');
}

export async function acquireSubmissionLock(tx: Prisma.TransactionClient, fingerprint: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${fingerprint})::bigint)`;
}

/**
 * Coarse business rule lock key: serializes submissions for the same
 * customer + sector. This ensures absolute strictness: one active case
 * per sector per customer, globally.
 */
export function buildCustomerSectorLockFingerprint(customerId: string, sectorId: string): string {
  return `loan-active-case:${customerId}:${sectorId}`;
}

/** At most ONE active (non-terminal) case per customer + sector globally. */
export async function findActiveCaseForCustomerSector(
  tx: Prisma.TransactionClient,
  customerId: string,
  sectorId: string,
): Promise<{ id: string; loanNumber: string } | null> {
  return tx.loanRequest.findFirst({
    where: {
      customerId,
      sectorId: sectorId,
      isTerminalStage: false,
    },
    orderBy: { submittedDate: 'asc' }, // earliest = the original case
    select: { id: true, loanNumber: true },
  });
}

/**
 * Looks up an existing active case by customer EMAIL + sector, for use in
 * catch blocks (outside the failed transaction).
 */
export async function findActiveCaseByCustomerEmailSector(
  client: { loanRequest: Prisma.TransactionClient['loanRequest'] },
  customerEmail: string,
  sectorId: string,
): Promise<{ id: string; loanNumber: string } | null> {
  return client.loanRequest.findFirst({
    where: {
      customer: { email: normalizeSubmissionEmail(customerEmail) },
      sectorId: sectorId,
      isTerminalStage: false,
    },
    orderBy: { submittedDate: 'asc' },
    select: { id: true, loanNumber: true },
  });
}

/**
 * Acquires a customer+sector advisory lock and returns the existing active
 * case if one already exists. MUST be called inside a transaction.
 * This is the ultimate strict guard: it ignores which department the case
 * is currently in and blocks any new submission for the same sector.
 */
export async function guardActiveCasePerCustomerSector(
  tx: Prisma.TransactionClient,
  customerId: string,
  sectorId: string,
): Promise<{ id: string; loanNumber: string } | null> {
  await acquireSubmissionLock(tx, buildCustomerSectorLockFingerprint(customerId, sectorId));
  return findActiveCaseForCustomerSector(tx, customerId, sectorId);
}

/** Active (non-terminal) duplicate for the same customer application, any channel. */
export async function findActiveDuplicateSubmission(
  tx: Prisma.TransactionClient,
  loanData: any,
  customerId: string,
) {
  const normalizedPurpose = normalizeSubmissionText(loanData.loanPurpose).toLowerCase();
  const normalizedAmountNum = Number(normalizeLoanAmount(loanData.loanAmount));

  return tx.loanRequest.findFirst({
    where: {
      customerId,
      loanAmount: normalizedAmountNum,
      sectorId: loanData.sectorId,
      requestTypeId: loanData.requestTypeId,
      loanPurpose: {
        equals: normalizedPurpose,
        mode: 'insensitive',
      },
      isTerminalStage: false,
    },
    orderBy: { submittedDate: 'desc' },
    select: { id: true },
  });
}

export async function claimSubmissionDedupSlot(
  tx: Prisma.TransactionClient,
  dedupKey: string,
): Promise<{ existingLoanRequestId: string } | { claimed: true }> {
  const existing = await tx.loanSubmissionDedup.findUnique({
    where: { dedupKey },
    select: { loanRequestId: true },
  });
  if (existing?.loanRequestId) {
    return { existingLoanRequestId: existing.loanRequestId };
  }
  if (existing) {
    throw new Error('Submission dedup slot is reserved but not finalized');
  }

  try {
    await tx.loanSubmissionDedup.create({ data: { dedupKey } });
    return { claimed: true };
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2002') {
      const raced = await tx.loanSubmissionDedup.findUnique({
        where: { dedupKey },
        select: { loanRequestId: true },
      });
      if (raced?.loanRequestId) {
        return { existingLoanRequestId: raced.loanRequestId };
      }
      throw new Error('Submission dedup slot contention without finalized loan');
    }
    throw e;
  }
}

export async function finalizeSubmissionDedup(
  tx: Prisma.TransactionClient,
  dedupKey: string,
  loanRequestId: string,
) {
  await tx.loanSubmissionDedup.update({
    where: { dedupKey },
    data: { loanRequestId },
  });
}

/** Release dedup slot when a case is terminal so a future application can be filed. */
export async function releaseSubmissionDedupForLoan(
  tx: Prisma.TransactionClient,
  loanRequestId: string,
) {
  await tx.loanSubmissionDedup.deleteMany({ where: { loanRequestId } });
}

export async function guardAgainstDuplicateSubmission(
  tx: Prisma.TransactionClient,
  loanData: any,
  customerId: string,
): Promise<{ id: string } | { dedupKey: string; claimed: true }> {
  const dedupKey = buildPermanentSubmissionDedupKey(customerId, loanData);

  const active = await findActiveDuplicateSubmission(tx, loanData, customerId);
  if (active) {
    return { id: active.id };
  }

  const slot = await tx.loanSubmissionDedup.findUnique({
    where: { dedupKey },
    select: { loanRequestId: true },
  });
  if (slot?.loanRequestId) {
    const linked = await tx.loanRequest.findUnique({
      where: { id: slot.loanRequestId },
      select: { id: true, isTerminalStage: true },
    });
    if (linked && !linked.isTerminalStage) {
      return { id: linked.id };
    }
    if (linked?.isTerminalStage) {
      await tx.loanSubmissionDedup.delete({ where: { dedupKey } }).catch(() => undefined);
    }
  }

  const claim = await claimSubmissionDedupSlot(tx, dedupKey);
  if ('existingLoanRequestId' in claim) {
    return { id: claim.existingLoanRequestId };
  }

  const activeAfterClaim = await findActiveDuplicateSubmission(tx, loanData, customerId);
  if (activeAfterClaim) {
    await tx.loanSubmissionDedup.delete({ where: { dedupKey } }).catch(() => undefined);
    return { id: activeAfterClaim.id };
  }

  return { dedupKey, claimed: true };
}
