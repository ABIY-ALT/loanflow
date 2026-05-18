import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  // Find users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      department: { select: { name: true } },
      customRole: { select: { name: true } }
    }
  });
  console.log('--- USERS ---');
  console.log(JSON.stringify(users, null, 2));

  // Find loans
  const loans = await prisma.loanRequest.findMany({
    include: {
      customer: true,
      currentWorkflowStage: true,
    }
  });
  console.log('--- LOANS ---');
  console.log(JSON.stringify(loans, null, 2));

  await prisma.$disconnect();
}

run();
