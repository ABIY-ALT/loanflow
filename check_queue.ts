import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkQueue() {
  const queue = await prisma.valuationQueue.findMany({
    include: {
        assignedTo: true,
        loanRequest: true
    }
  });
  console.log('Current Valuation Queue:', JSON.stringify(queue, null, 2));
  await prisma.$disconnect();
}

checkQueue();
