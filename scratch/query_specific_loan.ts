import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const loan = await prisma.loanRequest.findUnique({
    where: { id: 'cmp6xdtne0001oofsl7el4ia2' },
    include: {
      workflowVersion: {
        include: {
          stages: {
            orderBy: { order: 'asc' },
            include: { responsibleDepartment: true }
          }
        }
      }
    }
  });

  if (!loan) {
    console.log('Loan not found.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Loan: ${loan.loanNumber}, SubmissionType: ${loan.submissionType}`);
  if (loan.workflowVersion) {
    console.log(`Workflow Version: ${loan.workflowVersion.id}`);
    loan.workflowVersion.stages.forEach(s => {
      console.log(`  Stage ${s.order}: ${s.name} (Dept: ${s.responsibleDepartment.name})`);
    });
  } else {
    console.log('No workflow version attached.');
  }

  await prisma.$disconnect();
}

run();
