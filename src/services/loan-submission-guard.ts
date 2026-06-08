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
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
 * Coarse business rule lock key: serializes ALL submissions for the same
 * customer + department, regardless of sector / amount / purpose. This is what
 * prevents a human from re-submitting the same customer to the same department
 * with slightly different fields (e.g. switching child sector each time).
 */
export function buildCustomerDepartmentLockFingerprint(customerId: string, departmentId: string): string {
  return `loan-active-case:${customerId}:${departmentId}`;
}

/** At most ONE active (non-terminal) case per customer + department. */
export async function findActiveCaseForCustomerDepartment(
  tx: Prisma.TransactionClient,
  customerId: string,
  departmentId: string,
): Promise<{ id: string; loanNumber: string } | null> {
  return tx.loanRequest.findFirst({
    where: {
      customerId,
      assignedDepartmentId: departmentId,
      isTerminalStage: false,
    },
    orderBy: { submittedDate: 'asc' }, // earliest = the original case
    select: { id: true, loanNumber: true },
  });
}

/**
 * Looks up an existing active case by customer EMAIL + department, for use in
 * catch blocks (outside the failed transaction) to recover from a unique-index
 * violation gracefully. Accepts the base PrismaClient or a transaction client.
 */
export async function findActiveCaseByCustomerEmailDepartment(
  client: { loanRequest: Prisma.TransactionClient['loanRequest'] },
  customerEmail: string,
  departmentId: string,
): Promise<{ id: string; loanNumber: string } | null> {
  return client.loanRequest.findFirst({
    where: {
      customer: { email: normalizeSubmissionEmail(customerEmail) },
      assignedDepartmentId: departmentId,
      isTerminalStage: false,
    },
    orderBy: { submittedDate: 'asc' },
    select: { id: true, loanNumber: true },
  });
}

/**
 * Acquires a customer+department advisory lock and returns the existing active
 * case if one already exists. MUST be called inside a transaction, BEFORE the
 * fingerprint guard and BEFORE creating a new LoanRequest. Because both creation
 * paths take the same lock key, two concurrent submissions for the same
 * customer+department are serialized: the first creates, the second observes the
 * existing case and returns it instead of creating a duplicate.
 */
export async function guardActiveCasePerCustomerDepartment(
  tx: Prisma.TransactionClient,
  customerId: string,
  departmentId: string,
): Promise<{ id: string; loanNumber: string } | null> {
  await acquireSubmissionLock(tx, buildCustomerDepartmentLockFingerprint(customerId, departmentId));
  return findActiveCaseForCustomerDepartment(tx, customerId, departmentId);
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
