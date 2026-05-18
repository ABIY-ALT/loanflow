import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding District Specialized Workflow ---');

  // 1. Find or Create Sector for District Loans
  const districtSector = await prisma.sector.upsert({
    where: { name: 'District Operations' },
    update: {},
    create: { name: 'District Operations' },
  });

  // 2. Find necessary departments
  const valuationDept = await prisma.department.findUnique({ where: { nameLowercase: 'property valuation department' } });
  const serviceDept = await prisma.department.findUnique({ where: { nameLowercase: 'service sector department' } });
  const districtDept = await prisma.department.findFirst({ where: { name: 'District' } });

  if (!valuationDept || !serviceDept || !districtDept) {
    console.error('Missing required departments. Roles for District might be missing.');
    return;
  }

  // 3. Create Workflow Definition
  const workflow = await prisma.workflowDefinition.upsert({
    where: { id: 'wf-district-specialized' },
    update: {
        name: 'District Specialized Loan Workflow',
        description: 'Multi-step workflow involving District Managers, CRMs, and HO Valuation.',
    },
    create: {
      id: 'wf-district-specialized',
      name: 'District Specialized Loan Workflow',
      description: 'Multi-step workflow involving District Managers, CRMs, and HO Valuation.',
      order: 10,
      departmentId: serviceDept.id,
      sectorId: districtSector.id,
    },
  });

  // 4. Create Workflow Version
  const version = await prisma.workflowVersion.create({
    data: {
      workflowDefinitionId: workflow.id,
      versionNumber: 1,
      isActive: true,
    },
  });

  const stages = [
    { name: 'District Director Secretary Submission', order: 0, dept: districtDept.id, roles: ['Secretary'] },
    { name: 'District Business Manager Assignment', order: 1, dept: districtDept.id, roles: ['Manager'] },
    { name: 'CRM PVR Preparation', order: 2, dept: districtDept.id, roles: ['CRM'] },
    { name: 'HO Valuation Review', order: 3, dept: valuationDept.id, roles: ['Property Valuation Officer'] },
    { name: 'CRM LAF & Summary Preparation', order: 4, dept: districtDept.id, roles: ['CRM'] },
    { name: 'District Operation Manager Check', order: 5, dept: districtDept.id, roles: ['Manager'] },
    { name: 'District Analyst Review', order: 6, dept: districtDept.id, roles: ['Credit Appraisal Officer'] },
    { name: 'Final Operation Manager Review', order: 7, dept: districtDept.id, roles: ['Manager'] },
    { name: 'Committee Distribution', order: 8, dept: districtDept.id, roles: ['Credit Appraisal Officer'] },
    { name: 'Committee Approval', order: 9, dept: districtDept.id, roles: ['Committee'] },
  ];

  for (const s of stages) {
    await prisma.workflowStageDefinition.create({
      data: {
        workflowVersionId: version.id,
        name: s.name,
        order: s.order,
        defaultTimelineDays: 3,
        percentageWeight: 10,
        responsibleDepartmentId: s.dept,
        allowedRoles: JSON.stringify(s.roles),
      },
    });
  }

  console.log('District Workflow seeded successfully.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
