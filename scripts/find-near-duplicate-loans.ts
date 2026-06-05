/**
 * Find loans that look like duplicates but differ by submissionType, amount format, etc.
 */
import prisma from '../src/lib/prisma';

async function main() {
  const loans = await prisma.loanRequest.findMany({
    include: { customer: { select: { email: true, name: true } } },
    orderBy: { submittedDate: 'desc' },
  });

  const byEmailAmount = new Map<string, typeof loans>();
  for (const l of loans) {
    const key = `${l.customer.email.toLowerCase()}|${Number(l.loanAmount)}|${l.sectorId}|${l.requestTypeId}|${l.loanPurpose.trim().toLowerCase()}`;
    const list = byEmailAmount.get(key) ?? [];
    list.push(l);
    byEmailAmount.set(key, list);
  }

  const crossType = [...byEmailAmount.entries()].filter(([, list]) => {
    if (list.length < 2) return false;
    const types = new Set(list.map((l) => l.submissionType));
    return types.size > 1;
  });

  const sameTypeMulti = [...byEmailAmount.entries()].filter(([, list]) => list.length > 1);

  console.log('Groups ignoring submissionType:', sameTypeMulti.length);
  console.log('Cross TYPE1/TYPE2 groups:', crossType.length);
  for (const [key, list] of [...sameTypeMulti, ...crossType].slice(0, 15)) {
    console.log('\n', key);
    for (const l of list) {
      console.log(`  ${l.submissionType} ${l.loanNumber} ${l.submittedDate.toISOString()} terminal=${l.isTerminalStage}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
