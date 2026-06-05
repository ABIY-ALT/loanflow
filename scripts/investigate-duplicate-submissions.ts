/**
 * Investigation: find LoanRequest rows that look like duplicate submissions.
 * Run: npx tsx scripts/investigate-duplicate-submissions.ts
 *      npx tsx scripts/investigate-duplicate-submissions.ts --since=2026-06-04
 */
import prisma from '../src/lib/prisma';
import { buildCanonicalCaseFingerprint } from '../src/lib/loan-submission-fingerprint';

function parseSinceArg(): Date | null {
  const arg = process.argv.find((a) => a.startsWith('--since='));
  if (!arg) return null;
  const d = new Date(arg.split('=')[1]);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const since = parseSinceArg();
  const loans = await prisma.loanRequest.findMany({
    where: since ? { submittedDate: { gte: since } } : undefined,
    select: {
      id: true,
      loanNumber: true,
      customerId: true,
      customer: { select: { name: true, email: true } },
      loanAmount: true,
      sectorId: true,
      requestTypeId: true,
      loanPurpose: true,
      submissionType: true,
      submittedDate: true,
      createdById: true,
      currentStageId: true,
      assignedDepartmentId: true,
      workflowVersionId: true,
    },
    orderBy: { submittedDate: 'desc' },
  });

  const groups = new Map<string, typeof loans>();
  for (const loan of loans) {
    const key = buildCanonicalCaseFingerprint({
      customerId: loan.customerId,
      loanAmount: loan.loanAmount,
      sectorId: loan.sectorId,
      requestTypeId: loan.requestTypeId,
      loanPurpose: loan.loanPurpose,
    });
    const list = groups.get(key) ?? [];
    list.push(loan);
    groups.set(key, list);
  }

  const duplicateGroups = [...groups.entries()].filter(([, list]) => list.length > 1);

  console.log(since ? `Scope: submitted since ${since.toISOString()}` : 'Scope: all loan requests');
  console.log(`Total loan requests: ${loans.length}`);
  console.log(`Duplicate case groups (same customer/amount/sector/type/purpose, any channel): ${duplicateGroups.length}`);
  const extraRows = duplicateGroups.reduce((n, [, list]) => n + list.length - 1, 0);
  console.log(`Extra rows from accidental duplicates: ${extraRows}`);
  console.log(`Rows that would display once after dedupeLoansBySubmission: ${loans.length - extraRows}`);

  for (const [key, list] of duplicateGroups.slice(0, 20)) {
    console.log('\n---');
    console.log('Fingerprint:', key);
    for (const l of list) {
      const deltaMs =
        list.length > 1
          ? Math.abs(new Date(l.submittedDate).getTime() - new Date(list[0].submittedDate).getTime())
          : 0;
      console.log({
        id: l.id,
        loanNumber: l.loanNumber,
        customer: l.customer.name,
        email: l.customer.email,
        submittedDate: l.submittedDate.toISOString(),
        createdById: l.createdById,
        currentStageId: l.currentStageId,
        assignedDepartmentId: l.assignedDepartmentId,
        workflowVersionId: l.workflowVersionId,
        deltaFromFirstMs: deltaMs,
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
