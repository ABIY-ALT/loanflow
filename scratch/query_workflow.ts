import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const loan = await prisma.loanRequest.findFirst({
    where: { submissionType: 'TYPE2' },
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

  if (!loan || !loan.workflowVersion) {
    console.log('No Type 2 loan or workflow version found.');
    await prisma.$disconnect();
    return;
  }

  console.log('Workflow Version Stages:');
  loan.workflowVersion.stages.forEach(s => {
    console.log(`Order: ${s.order}, Name: ${s.name}, Dept ID: ${s.responsibleDepartmentId}, Dept Name: ${s.responsibleDepartment.name}`);
  });

  await prisma.$disconnect();
}

run();
