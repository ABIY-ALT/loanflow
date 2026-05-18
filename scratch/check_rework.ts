import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const loan = await prisma.loanRequest.findUnique({
    where: { id: 'cmp6xdtne0001oofsl7el4ia2' },
    include: {
      assignedToUsers: true,
      currentWorkflowStage: true,
      history: {
        orderBy: { timestamp: 'desc' },
        take: 3,
        include: { user: true }
      }
    }
  });

  console.log(`Loan Number: ${loan?.loanNumber}`);
  console.log(`Current Stage: ${loan?.currentWorkflowStage?.name} (Order: ${loan?.currentWorkflowStage?.order})`);
  console.log(`Current Status: ${loan?.currentStageStatus}`);
  console.log(`Is Ready for Manager Review: ${loan?.isReadyForManagerReview}`);
  console.log(`Assigned To: ${loan?.assignedToUsers.map(u => u.name).join(', ')}`);
  
  console.log('\nLatest 3 History Entries:');
  loan?.history.forEach(h => {
    console.log(`- [${h.timestamp}] Stage: ${h.stageName}, User: ${h.user.name}, Note: ${h.notes}`);
  });

  await prisma.$disconnect();
}

run();
