/**
 * Removes duplicate LoanRequest rows (keeps canonical active case per application).
 * Dry-run by default. Pass --apply to delete.
 *
 * Run: npx tsx scripts/cleanup-duplicate-submissions.ts
 *      npx tsx scripts/cleanup-duplicate-submissions.ts --apply
 */
import prisma from '../src/lib/prisma';
import { buildCanonicalCaseFingerprint, canonicalSubmissionScore } from '../src/lib/loan-submission-fingerprint';

const apply = process.argv.includes('--apply');

async function main() {
  const loans = await prisma.loanRequest.findMany({
    select: {
      id: true,
      loanNumber: true,
      customerId: true,
      loanAmount: true,
      sectorId: true,
      requestTypeId: true,
      loanPurpose: true,
      submissionType: true,
      lastUpdatedDate: true,
      workflowVersionId: true,
      currentStageId: true,
      isTerminalStage: true,
    },
    orderBy: { lastUpdatedDate: 'desc' },
  });

  const keepIds = new Set<string>();
  const deleteIds: string[] = [];

  const bestByFingerprint = new Map<string, (typeof loans)[0]>();
  for (const loan of loans) {
    const fp = buildCanonicalCaseFingerprint({
      customerId: loan.customerId,
      loanAmount: loan.loanAmount,
      sectorId: loan.sectorId,
      requestTypeId: loan.requestTypeId,
      loanPurpose: loan.loanPurpose,
    });
    const existing = bestByFingerprint.get(fp);
    if (!existing || canonicalSubmissionScore(loan) > canonicalSubmissionScore(existing)) {
      bestByFingerprint.set(fp, loan);
    }
  }

  for (const loan of loans) {
    const fp = buildCanonicalCaseFingerprint({
      customerId: loan.customerId,
      loanAmount: loan.loanAmount,
      sectorId: loan.sectorId,
      requestTypeId: loan.requestTypeId,
      loanPurpose: loan.loanPurpose,
    });
    const keeper = bestByFingerprint.get(fp);
    if (keeper?.id === loan.id) {
      keepIds.add(loan.id);
    } else {
      deleteIds.push(loan.id);
    }
  }

  console.log(`Duplicate rows to remove: ${deleteIds.length}`);
  if (deleteIds.length) {
    console.log('Sample ids:', deleteIds.slice(0, 10));
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to delete duplicate rows.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.loanSubmissionDedup.deleteMany({ where: { loanRequestId: { in: deleteIds } } });
    await tx.loanRequest.deleteMany({ where: { id: { in: deleteIds } } });
  });
  console.log(`Deleted ${deleteIds.length} duplicate LoanRequest row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
