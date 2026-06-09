
import prisma from '../src/lib/prisma';
import { 
  guardAgainstDuplicateSubmission, 
  finalizeSubmissionDedup,
  generateUniqueLoanNumber,
  normalizeSubmissionText
} from '../src/services/loan-submission-guard';
import { normalizeLoanAmount } from '../src/lib/loan-submission-fingerprint';

async function main() {
  console.log('--- Verifying Duplicate Rejection Rules ---');

  // 1. Setup fixtures
  const customer = await prisma.customer.findFirst();
  const sector1 = await prisma.sector.findFirst({ where: { parentId: { not: null } } });
  const sector2 = await prisma.sector.findFirst({ where: { parentId: { not: null }, id: { not: sector1?.id } } });
  const requestType = await prisma.requestType.findFirst();
  const user = await prisma.user.findFirst();

  if (!customer || !sector1 || !sector2 || !requestType || !user) {
    console.error('Missing fixtures. Please run seed script first.');
    return;
  }

  const baseLoanData = {
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    customerBranch: customer.branch,
    loanAmount: 1000000,
    sectorId: sector1.id,
    requestTypeId: requestType.id,
    loanPurpose: 'Test business expansion purpose',
  };

  console.log(`Testing with Customer: ${customer.name}, Sector: ${sector1.name}, Amount: ${baseLoanData.loanAmount}`);

  // 2. Create the first loan
  const result1 = await prisma.$transaction(async (tx) => {
    const guard = await guardAgainstDuplicateSubmission(tx, baseLoanData, customer.id);
    if ('id' in guard) throw new Error('First submission unexpectedly blocked');
    
    const loan = await tx.loanRequest.create({
      data: {
        loanNumber: generateUniqueLoanNumber('TEST'),
        customerId: customer.id,
        loanAmount: baseLoanData.loanAmount,
        sectorId: baseLoanData.sectorId,
        requestTypeId: baseLoanData.requestTypeId,
        loanPurpose: baseLoanData.loanPurpose,
        isTerminalStage: false,
      }
    });
    await finalizeSubmissionDedup(tx, guard.dedupKey, loan.id);
    return loan;
  });
  console.log(`✅ First loan created: ${result1.loanNumber}`);

  // 3. Try to submit EXACT SAME loan (Should be REJECTED)
  const result2 = await prisma.$transaction(async (tx) => {
    const guard = await guardAgainstDuplicateSubmission(tx, baseLoanData, customer.id);
    return guard;
  });
  
  if ('id' in result2) {
    console.log(`✅ Exact duplicate REJECTED as expected (Returned ID: ${result2.id})`);
  } else {
    console.log('❌ FAIL: Exact duplicate was NOT rejected');
  }

  // 4. Try with DIFFERENT AMOUNT (Should be ACCEPTED)
  const differentAmountData = { ...baseLoanData, loanAmount: 2000000 };
  const result3 = await prisma.$transaction(async (tx) => {
    const guard = await guardAgainstDuplicateSubmission(tx, differentAmountData, customer.id);
    if ('id' in guard) return { error: 'Blocked' };
    
    const loan = await tx.loanRequest.create({
      data: {
        loanNumber: generateUniqueLoanNumber('TEST'),
        customerId: customer.id,
        loanAmount: differentAmountData.loanAmount,
        sectorId: differentAmountData.sectorId,
        requestTypeId: differentAmountData.requestTypeId,
        loanPurpose: differentAmountData.loanPurpose,
        isTerminalStage: false,
      }
    });
    await finalizeSubmissionDedup(tx, guard.dedupKey, loan.id);
    return loan;
  });

  if ('loanNumber' in result3) {
    console.log(`✅ Different amount ACCEPTED as expected: ${result3.loanNumber}`);
  } else {
    console.log('❌ FAIL: Different amount was unexpectedly rejected');
  }

  // 5. Try with DIFFERENT SECTOR (Should be ACCEPTED)
  const differentSectorData = { ...baseLoanData, sectorId: sector2.id };
  const result4 = await prisma.$transaction(async (tx) => {
    const guard = await guardAgainstDuplicateSubmission(tx, differentSectorData, customer.id);
    if ('id' in guard) return { error: 'Blocked' };
    
    const loan = await tx.loanRequest.create({
      data: {
        loanNumber: generateUniqueLoanNumber('TEST'),
        customerId: customer.id,
        loanAmount: differentSectorData.loanAmount,
        sectorId: differentSectorData.sectorId,
        requestTypeId: differentSectorData.requestTypeId,
        loanPurpose: differentSectorData.loanPurpose,
        isTerminalStage: false,
      }
    });
    await finalizeSubmissionDedup(tx, guard.dedupKey, loan.id);
    return loan;
  });

  if ('loanNumber' in result4) {
    console.log(`✅ Different sector ACCEPTED as expected: ${result4.loanNumber}`);
  } else {
    console.log('❌ FAIL: Different sector was unexpectedly rejected');
  }

  // Cleanup test data
  await prisma.loanSubmissionDedup.deleteMany({
    where: { loanRequestId: { in: [result1.id, (result3 as any).id, (result4 as any).id] } }
  });
  await prisma.loanRequest.deleteMany({
    where: { id: { in: [result1.id, (result3 as any).id, (result4 as any).id] } }
  });
  console.log('\n--- Cleanup complete ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
