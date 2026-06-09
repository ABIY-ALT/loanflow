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

// ---------------------------------------------------------------------------
// Placeholder-email detection
// ---------------------------------------------------------------------------

const PLACEHOLDER_EMAILS = new Set([
  'noemail@gmail.com',
  'noemail@yahoo.com',
  'noemail@hotmail.com',
  'no-email@gmail.com',
  'noreply@gmail.com',
  'placeholder@gmail.com',
  'dummy@gmail.com',
  'none@gmail.com',
  'null@gmail.com',
  'empty@gmail.com',
  'notavailable@gmail.com',
  'na@gmail.com',
  'test@gmail.com',
  'default@gmail.com',
]);

/** Returns true when the (already-normalized) email is a known placeholder or blank. */
export function isPlaceholderEmail(normalizedEmail: string): boolean {
  if (!normalizedEmail) return true;
  if (PLACEHOLDER_EMAILS.has(normalizedEmail)) return true;
  // Catch variants: noemail@…, no-email@…, no_email@…
  if (/^no[_.-]?email@/i.test(normalizedEmail)) return true;
  // Catch previously-generated synthetic addresses
  if (normalizedEmail.endsWith('@no-email.internal')) return true;
  return false;
}

/** Generate a unique synthetic email for customers who have no real email. */
export function generateGuestCustomerEmail(): string {
  const ts = Date.now().toString(36);
  const r1 = Math.random().toString(36).substring(2, 8);
  const r2 = Math.random().toString(36).substring(2, 8);
  return `guest-${ts}-${r1}${r2}@no-email.internal`;
}

// ---------------------------------------------------------------------------

/**
 * Advisory-lock fingerprint for a submission.
 *
 * When the email is a placeholder we key on phone number instead so that:
 *   – concurrent same-phone/same-details submissions are serialised (correct dedup)
 *   – different-phone submissions don't unnecessarily block each other
 */
export function buildSubmissionLockFingerprint(loanData: any): string {
  const normalizedEmail = normalizeSubmissionEmail(loanData.customerEmail);
  const phone = normalizeEthiopianPhone(loanData.customerPhone) || normalizeSubmissionText(loanData.customerPhone);
  const customerKey = isPlaceholderEmail(normalizedEmail)
    ? `phone:${phone}`
    : `email:${normalizedEmail}`;

  return JSON.stringify({
    customerKey,
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

/**
 * Acquires a submission advisory lock.
 * MUST be called inside a transaction.
 */
export async function acquireSubmissionLock(tx: Prisma.TransactionClient, fingerprint: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${fingerprint})::bigint)`;
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
