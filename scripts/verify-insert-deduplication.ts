/**
 * Insert-path verification: sequential + concurrent submissions against real transaction guards.
 * Run: npx tsx scripts/verify-insert-deduplication.ts
 */
import prisma from '../src/lib/prisma';
import { addDays, subMinutes } from 'date-fns';
import { buildCanonicalCaseFingerprint } from '../src/lib/loan-submission-fingerprint';
import {
  acquireSubmissionLock,
  buildSubmissionLockFingerprint,
  finalizeSubmissionDedup,
  guardAgainstDuplicateSubmission,
  generateUniqueLoanNumber,
  normalizeSubmissionEmail,
  normalizeSubmissionText,
} from '../src/services/loan-submission-guard';
import { normalizeEthiopianPhone } from '../src/lib/utils';
import { safeJsonParse } from '../src/services/utils/mappers';

const TEST_TAG = 'verify-dedup-20260604';

type SubmissionResult = { id: string; created: boolean };

async function countRows() {
  return prisma.loanRequest.count();
}

async function countDuplicateGroups() {
  const loans = await prisma.loanRequest.findMany({
    select: {
      customerId: true,
      loanAmount: true,
      sectorId: true,
      requestTypeId: true,
      loanPurpose: true,
      submissionType: true,
    },
  });
  const groups = new Map<string, number>();
  for (const loan of loans) {
    const key = buildCanonicalCaseFingerprint({
      customerId: loan.customerId,
      loanAmount: loan.loanAmount,
      sectorId: loan.sectorId,
      requestTypeId: loan.requestTypeId,
      loanPurpose: loan.loanPurpose,
    });
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const duplicateGroups = [...groups.values()].filter((n) => n > 1).length;
  const extraRows = [...groups.values()].reduce((sum, n) => sum + Math.max(0, n - 1), 0);
  return { duplicateGroups, extraRows, total: loans.length };
}

async function countNewTestDuplicates() {
  const loans = await prisma.loanRequest.findMany({
    where: { loanPurpose: { contains: TEST_TAG } },
    select: {
      id: true,
      loanNumber: true,
      customerId: true,
      loanAmount: true,
      sectorId: true,
      requestTypeId: true,
      loanPurpose: true,
      submissionType: true,
      submittedDate: true,
    },
    orderBy: { submittedDate: 'asc' },
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
  const dupGroups = [...groups.entries()].filter(([, list]) => list.length > 1);
  return { loans, dupGroups, extraRows: dupGroups.reduce((n, [, l]) => n + l.length - 1, 0) };
}

async function loadFixtures() {
  const user = await prisma.user.findFirst({
    where: { isActive: true, customRole: { permissions: { contains: 'CREATE_LOAN_REQUEST' } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) throw new Error('No active user with CREATE_LOAN_REQUEST');

  const sector = await prisma.sector.findFirst({
    where: { parentId: { not: null } },
    orderBy: { name: 'asc' },
  });
  if (!sector) throw new Error('No child sector');

  const requestType = await prisma.requestType.findFirst({ orderBy: { name: 'asc' } });
  if (!requestType) throw new Error('No request type');

  const branch = await prisma.branch.findFirst({ orderBy: { name: 'asc' } });

  const districtWorkflowVersion = await prisma.workflowVersion.findFirst({
    where: { workflowDefinition: { id: 'wf-district-specialized' }, isActive: true },
    include: {
      workflowDefinition: true,
      stages: { orderBy: { order: 'asc' }, include: { responsibleDepartment: true } },
    },
  });
  if (!districtWorkflowVersion?.stages.length) {
    throw new Error('District workflow missing');
  }

  return { user, sector, requestType, branch, districtWorkflowVersion };
}

function buildLoanData(
  fixtures: Awaited<ReturnType<typeof loadFixtures>>,
  suffix: string,
  overrides: Partial<{
    customerEmail: string;
    loanAmount: number;
    loanPurpose: string;
  }> = {},
) {
  return {
    customerName: `Verify ${suffix}`,
    customerEmail: overrides.customerEmail ?? `verify-${suffix}@dedup-test.local`,
    customerPhone: '+251911000000',
    customerBranch: fixtures.branch?.name ?? 'Test Branch',
    loanAmount: overrides.loanAmount ?? 100000 + Math.floor(Math.random() * 900000),
    sectorId: fixtures.sector.id,
    requestTypeId: fixtures.requestType.id,
    loanPurpose: overrides.loanPurpose ?? `${TEST_TAG} purpose ${suffix}`,
  };
}

/** Mirrors addType2LoanRequest transaction body (insert guards + create). */
async function submitType2LikeServer(
  fixtures: Awaited<ReturnType<typeof loadFixtures>>,
  loanData: ReturnType<typeof buildLoanData>,
): Promise<SubmissionResult> {
  const { user, districtWorkflowVersion } = fixtures;
  const currentDate = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await acquireSubmissionLock(tx, buildSubmissionLockFingerprint(loanData));

    const normalizedCustomerPhone = normalizeEthiopianPhone(loanData.customerPhone);
    const customer = await tx.customer.upsert({
      where: { email: normalizeSubmissionEmail(loanData.customerEmail) },
      update: {
        name: normalizeSubmissionText(loanData.customerName),
        phone: normalizedCustomerPhone || null,
        branch: normalizeSubmissionText(loanData.customerBranch) || null,
      },
      create: {
        email: normalizeSubmissionEmail(loanData.customerEmail),
        name: normalizeSubmissionText(loanData.customerName),
        phone: normalizedCustomerPhone || null,
        branch: normalizeSubmissionText(loanData.customerBranch) || null,
      },
    });

    const guard = await guardAgainstDuplicateSubmission(tx, loanData, customer.id);
    if ('id' in guard) {
      return { id: guard.id, created: false };
    }

    const targetStageIndex = districtWorkflowVersion.stages.length > 1 ? 1 : 0;
    const activeStage = districtWorkflowVersion.stages[targetStageIndex];
    const initialDepartment = activeStage.responsibleDepartment;
    const stageDeadlineDate = addDays(currentDate, activeStage.defaultTimelineDays);
    const availableStatusesObj = safeJsonParse(activeStage.availableStatuses, {});
    const availableStatusesForDept = (availableStatusesObj as Record<string, string[]>)[initialDepartment.name] || [];
    const initialStatus = availableStatusesForDept.length > 0 ? availableStatusesForDept[0] : 'Initiated';

    const created = await tx.loanRequest.create({
      data: {
        loanNumber: generateUniqueLoanNumber('LN-T2'),
        customer: { connect: { id: customer.id } },
        loanAmount: loanData.loanAmount,
        sector: { connect: { id: loanData.sectorId } },
        requestType: { connect: { id: loanData.requestTypeId } },
        loanPurpose: normalizeSubmissionText(loanData.loanPurpose),
        submittedDate: currentDate,
        lastUpdatedDate: currentDate,
        stageEntryDate: currentDate,
        stageDeadline: stageDeadlineDate,
        submissionType: 'TYPE2',
        lafStatus: 'PENDING',
        isReadyForManagerReview: true,
        workflowVersion: { connect: { id: districtWorkflowVersion.id } },
        currentWorkflowStage: { connect: { id: activeStage.id } },
        assignedDepartment: { connect: { id: initialDepartment.id } },
        currentStageStatus: initialStatus,
        createdBy: { connect: { id: user.id } },
        assignedToUsers: { connect: { id: user.id } },
        history: {
          create: {
            stageName: activeStage.name,
            timestamp: currentDate,
            notes: `Verification test ${TEST_TAG}`,
            user: { connect: { id: user.id } },
          },
        },
      },
      select: { id: true },
    });
    await finalizeSubmissionDedup(tx, guard.dedupKey, created.id);
    return { id: created.id, created: true };
  });

  return result;
}

/** Prove advisory lock + dedup row share one transaction (rolled back together). */
async function verifyTransactionScope() {
  const dedupKey = `rollback-proof-${Date.now()}`;
  await prisma
    .$transaction(async (tx) => {
      await acquireSubmissionLock(tx, 'rollback-proof-lock');
      await tx.loanSubmissionDedup.create({ data: { dedupKey } });
      throw new Error('intentional rollback');
    })
    .catch(() => undefined);
  const leftover = await prisma.loanSubmissionDedup.findUnique({ where: { dedupKey } });
  return leftover === null;
}

async function main() {
  console.log('=== Insert-path verification ===\n');
  console.log('Insert guard: permanent canonical case identity (no time window)\n');

  const fixtures = await loadFixtures();
  const baseline = await countRows();
  const baselineDupes = await countDuplicateGroups();
  const historicalDupes = baselineDupes.duplicateGroups;

  console.log('BEFORE tests:');
  console.log(`  LoanRequest rows: ${baseline}`);
  console.log(`  All-time duplicate groups: ${baselineDupes.duplicateGroups}`);
  console.log(`  All-time extra duplicate rows: ${baselineDupes.extraRows}\n`);

  const txnOk = await verifyTransactionScope();
  console.log(`4. Lock + create in same transaction: ${txnOk ? 'PASS' : 'FAIL'}\n`);

  // 10 unique sequential submissions
  const sequentialIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const data = buildLoanData(fixtures, `seq-${i}`);
    const r = await submitType2LikeServer(fixtures, data);
    sequentialIds.push(r.id);
    if (!r.created) {
      console.error(`FAIL: sequential #${i} unexpectedly reused id ${r.id}`);
      process.exitCode = 1;
    }
  }
  const afterSequential = await countRows();
  const sequentialNewRows = afterSequential - baseline;
  console.log('1–2. Ten unique sequential submissions:');
  console.log(`  New rows created: ${sequentialNewRows} (expected 10)`);
  console.log(`  Unique returned ids: ${new Set(sequentialIds).size} (expected 10)`);
  console.log(`  Result: ${sequentialNewRows === 10 && new Set(sequentialIds).size === 10 ? 'PASS' : 'FAIL'}\n`);

  // Concurrent identical payload
  const concurrentEmail = `verify-concurrent-${Date.now()}@dedup-test.local`;
  const concurrentData = buildLoanData(fixtures, 'concurrent', {
    customerEmail: concurrentEmail,
    loanAmount: 555555,
    loanPurpose: `${TEST_TAG} concurrent burst`,
  });
  const beforeConcurrent = await countRows();
  const burst = 25;
  const concurrentResults = await Promise.all(
    Array.from({ length: burst }, () => submitType2LikeServer(fixtures, concurrentData)),
  );
  const afterConcurrent = await countRows();
  const concurrentNewRows = afterConcurrent - beforeConcurrent;
  const uniqueConcurrentIds = new Set(concurrentResults.map((r) => r.id));
  const createdCount = concurrentResults.filter((r) => r.created).length;
  const reusedCount = concurrentResults.filter((r) => !r.created).length;

  console.log('7. Near-simultaneous duplicate payload (25 parallel calls):');
  console.log(`  New rows in DB: ${concurrentNewRows} (expected 1)`);
  console.log(`  Unique ids returned: ${uniqueConcurrentIds.size} (expected 1)`);
  console.log(`  Responses marked created: ${createdCount}, reused: ${reusedCount}`);
  console.log(`  Result: ${concurrentNewRows === 1 && uniqueConcurrentIds.size === 1 ? 'PASS' : 'FAIL'}\n`);

  // DB safeguards inventory
  const indexes = await prisma.$queryRaw<{ indexname: string; tablename: string }[]>`
    SELECT indexname, tablename FROM pg_indexes
    WHERE tablename IN ('LoanRequest', 'LoanSubmissionDedup')
    ORDER BY tablename, indexname`;
  console.log('6. Database safeguards present:');
  console.log('  - LoanRequest.loanNumber UNIQUE:', indexes.some((i) => i.indexname.includes('loanNumber')));
  console.log('  - LoanSubmissionDedup.dedupKey PRIMARY:', indexes.some((i) => i.tablename === 'LoanSubmissionDedup' && i.indexname.includes('pkey')));
  console.log('  - pg_advisory_xact_lock: used in submission transaction (see loan-submission-guard.ts)');
  console.log('  Indexes:', indexes.map((i) => `${i.tablename}.${i.indexname}`).join(', ') || '(none)');
  console.log('');

  const newTestScan = await countNewTestDuplicates();
  console.log('3. New test submissions only (loanPurpose contains tag):');
  console.log(`  Test rows: ${newTestScan.loans.length}`);
  console.log(`  Duplicate groups among new tests: ${newTestScan.dupGroups.length} (expected 0)`);
  console.log(`  Extra rows among new tests: ${newTestScan.extraRows} (expected 0)`);
  if (newTestScan.dupGroups.length) {
    for (const [key, list] of newTestScan.dupGroups) {
      console.log('  Dupe group:', key, list.map((l) => l.loanNumber));
    }
  }
  console.log('');

  const afterAll = await countDuplicateGroups();
  console.log('9. Historical duplicates (all-time, includes pre-fix data):');
  console.log(`  Duplicate groups: ${afterAll.duplicateGroups} (historical baseline was ${historicalDupes})`);
  console.log(`  Extra rows: ${afterAll.extraRows}`);
  console.log(`  Cleanup script recommended: ${afterAll.duplicateGroups > 0 ? 'YES' : 'NO'}\n`);

  console.log('=== Final conclusion ===');
  const insertPass =
    sequentialNewRows === 10 &&
    concurrentNewRows === 1 &&
    newTestScan.dupGroups.length === 0;
  if (insertPass) {
    console.log(
      'INSERT-TIME ROOT CAUSE: ELIMINATED for new submissions (transaction lock + duplicate guard + LoanSubmissionDedup unique key).',
    );
    console.log(
      `READ-PATH: Historical duplicate groups (${afterAll.duplicateGroups}) remain in DB from before the fix; UI dedupe hides them but cleanup is still recommended.`,
    );
  } else {
    console.log(
      'INSERT-TIME: STILL FAILING — duplicate LoanRequest rows can be created; system may rely on read-path dedupe.',
    );
  }

  if (process.exitCode !== 1 && !insertPass) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
