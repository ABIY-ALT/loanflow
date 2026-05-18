import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const loan = await prisma.loanRequest.findFirst({
    where: { loanNumber: 'LN-T2-037848' },
    include: { workflowVersion: { include: { stages: true } } }
  });

  if (!loan) {
    console.error('Loan not found');
    return;
  }

  const stage7 = loan.workflowVersion?.stages.find(s => s.order === 7);
  if (!stage7) {
    console.error('Stage 7 not found');
    return;
  }

  await prisma.loanRequest.update({
    where: { id: loan.id },
    data: {
      currentStageId: stage7.id,
      assignedDepartmentId: stage7.responsibleDepartmentId,
      isReadyForManagerReview: true,
      currentStageStatus: 'Awaiting Manager Review',
      assignedToUsers: { set: [] }
    }
  });

  console.log('Successfully promoted loan to Stage 7: Final Operation Manager Review');
  await prisma.$disconnect();
}

run();
