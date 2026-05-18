import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const loan = await prisma.loanRequest.findFirst({
    where: { loanNumber: 'LN-T2-327412' },
    include: {
        assignedDepartment: true,
        createdBy: { include: { department: true } }
    }
  });
  console.log('Loan Data:', JSON.stringify(loan, null, 2));

  if (loan && loan.assignedDepartmentId) {
    const analysts = await prisma.user.findMany({
      where: {
        departmentId: loan.assignedDepartmentId,
        isActive: true,
        customRole: {
          name: {
            contains: 'Analyst',
            mode: 'insensitive'
          }
        }
      },
      include: { customRole: true }
    });
    console.log('Analysts in loan department (Analyst filter):', JSON.stringify(analysts, null, 2));

    const appraisalOfficers = await prisma.user.findMany({
        where: {
          departmentId: loan.assignedDepartmentId,
          isActive: true,
          customRole: {
            name: {
              contains: 'Appraisal',
              mode: 'insensitive'
            }
          }
        },
        include: { customRole: true }
      });
      console.log('Analysts in loan department (Appraisal filter):', JSON.stringify(appraisalOfficers, null, 2));
  }
  
  const allAnalysts = await prisma.user.findMany({
      where: {
          customRole: {
              name: {
                  OR: [
                    { contains: 'Analyst', mode: 'insensitive' },
                    { contains: 'Appraisal', mode: 'insensitive' }
                  ]
              }
          }
      },
      include: { department: true, customRole: true }
  });
  console.log('All Analysts in System:', JSON.stringify(allAnalysts, null, 2));
}

main().finally(() => prisma.$disconnect());
