
import { PrismaClient, DocumentRequirementType } from '@prisma/client';
import { mockUsers as appMockUsers, mockDepartments } from '../src/lib/mock-data';
import type { Department as AppDepartment } from '../src/types/loan';
import { ALL_PERMISSIONS, PERMISSIONS } from '../src/lib/permissions';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  // --- Seed Sectors ---
  console.log('Seeding Sectors...');
  const parentSectors = [
    'Institutional Banking & Green Financing', 
    'Service & Mining Sectors', 
    'Manufacturing & Agriculture Sector'
  ];
  const childSectors: Record<string, string[]> = {
    'Institutional Banking & Green Financing': ['Financial Institution', 'Mining, Power and Water'],
    'Service & Mining Sectors': [
      'Domestic Trade and Service',
      'Hotel and Tourism',
      'Transport',
      'International Trade – Export',
      'International Trade – Import',
      'Personal Loan'
    ],
    'Manufacturing & Agriculture Sector': [
      'Manufacturing Industry',
      'Agriculture',
      'Building and Construction'
    ],
  };
  
  for (const sectorName of parentSectors) {
    const parent = await prisma.sector.upsert({
      where: { name: sectorName },
      update: {},
      create: { name: sectorName },
    });
    console.log(`Created/verified parent sector: ${sectorName}`);

    if (childSectors[sectorName]) {
      for (const childName of childSectors[sectorName]) {
        await prisma.sector.upsert({
          where: { name: childName },
          update: {
            parent: {
              connect: { id: parent.id }
            }
          },
          create: {
            name: childName,
            parent: {
              connect: { id: parent.id }
            }
          },
        });
        console.log(`  - Created/verified child sector: ${childName}`);
      }
    }
  }

  // --- Seed Request Types ---
  const requestTypes = ['New Loan', 'Restructuring', 'Additional Facility'];
  for (const requestTypeName of requestTypes) {
    await prisma.requestType.upsert({
      where: { name: requestTypeName },
      update: {},
      create: { name: requestTypeName },
    });
  }

  // Seed Departments
  console.log('Seeding Departments...');
  for (const deptName of mockDepartments) {
    await prisma.department.upsert({
      where: { nameLowercase: deptName.toLowerCase() },
      update: {},
      create: {
        name: deptName,
        nameLowercase: deptName.toLowerCase(),
      },
    });
  }

  // Seed Districts and Branches
  const districtsToSeed = {
    'South District': ['Gotera Ibex'],
    'North District': ['Abinet Adebabay'],
    'West District': [],
    'East District': [],
  };

  for (const districtName of Object.keys(districtsToSeed)) {
      const district = await prisma.district.upsert({
          where: { name: districtName },
          update: {},
          create: { name: districtName },
      });
      const branchesForDistrict = districtsToSeed[districtName as keyof typeof districtsToSeed];
      for (const branchName of branchesForDistrict) {
          await prisma.branch.upsert({
              where: { name_districtId: { name: branchName, districtId: district.id } },
              update: {},
              create: { name: branchName, districtId: district.id }
          });
      }
  }

  // Seed Roles
  console.log('Seeding Custom Roles...');
  const rolesToSeed = [
    { name: "Administrator", description: "Full access", permissions: ALL_PERMISSIONS },
    { name: "Chief", description: "High-level management", permissions: ALL_PERMISSIONS },
    { name: "CRM", description: "Customer Relationship Manager", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_CUSTOMERS, PERMISSIONS.CREATE_LOAN_REQUEST, PERMISSIONS.EDIT_LOAN_DETAILS, PERMISSIONS.UPLOAD_LOAN_DOCUMENTS, PERMISSIONS.ADD_LOAN_NOTES, PERMISSIONS.VIEW_OWN_ASSIGNED_CASES, PERMISSIONS.VIEW_OWN_SUBMITTED_CASES, PERMISSIONS.MARK_STAGE_COMPLETE, PERMISSIONS.PROMOTE_LOAN_STAGE] },
    { name: "Loan Officer", description: "Standard Loan Officer", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_LOAN_PIPELINE, PERMISSIONS.VIEW_LOAN_DETAILS, PERMISSIONS.VIEW_OWN_ASSIGNED_CASES, PERMISSIONS.EDIT_LOAN_DETAILS, PERMISSIONS.UPLOAD_LOAN_DOCUMENTS, PERMISSIONS.ADD_LOAN_NOTES, PERMISSIONS.VIEW_OWN_SUBMITTED_CASES, PERMISSIONS.MARK_STAGE_COMPLETE] },
    { name: "Secretary", description: "Submission and tracking", permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.CREATE_LOAN_REQUEST, PERMISSIONS.VIEW_OWN_SUBMITTED_CASES] }
  ];

  for (const roleData of rolesToSeed) {
    await prisma.role.upsert({
      where: { name: roleData.name },
      update: { description: roleData.description, permissions: roleData.permissions },
      create: { name: roleData.name, description: roleData.description, permissions: roleData.permissions },
    });
  }

  // Define specialized department mapping
  const workflowDeptMapping: Record<string, string> = {
    'WF-01': 'RM', // Will use sector default
    'WF-02': 'Director Property Valuation',
    'WF-03': 'RM',
    'WF-04': 'Director Property Valuation',
    'WF-05': 'Director Credit Analysis and Appraisal',
    'WF-06': 'RM',
    'WF-07': 'Director Credit Analysis and Appraisal',
    'WF-08': 'RM',
  };

  const standardWorkflowsToSeed = [
    { code: 'WF-01', name: 'WF-01 – RM Request Registration (Acceptance)', purpose: 'Initial registration.' },
    { code: 'WF-02', name: 'WF-02 – Valuation', purpose: 'Asset valuation.' },
    { code: 'WF-03', name: 'WF-03 – RM Valuation Result', purpose: 'Review results.' },
    { code: 'WF-04', name: 'WF-04 – Valuation Appeal', purpose: 'Handle appeals.' },
    { code: 'WF-05', name: 'WF-05 – Appraisal', purpose: 'Credit appraisal.' },
    { code: 'WF-06', name: 'WF-06 – RM Disbursement', purpose: 'Initial disbursement.' },
    { code: 'WF-07', name: 'WF-07 – Appraisal Appeal', purpose: 'Appraisal appeals.' },
    { code: 'WF-08', name: 'WF-08 – RM Final Disbursement', purpose: 'Final RM processing.' },
  ];
  
  const seedWorkflowPath = async (parentSectorName: string, childSectorName: string, sectorDeptName: string) => {
    console.log(`--- Seeding Workflows for ${parentSectorName} (${childSectorName})...`);
    const parentSector = await prisma.sector.findUnique({ where: { name: parentSectorName } });
    const childSector = await prisma.sector.findUnique({ where: { name: childSectorName } });
    const sectorDept = await prisma.department.findUnique({ where: { nameLowercase: sectorDeptName.toLowerCase() } });
  
    if (!parentSector || !childSector || !sectorDept) return;

    let currentMaxOrder = -1;
  
    for (const [index, wf] of standardWorkflowsToSeed.entries()) {
      const targetDeptName = workflowDeptMapping[wf.code] === 'RM' ? sectorDeptName : workflowDeptMapping[wf.code];
      const dept = await prisma.department.findUnique({ where: { nameLowercase: targetDeptName.toLowerCase() } });
      if (!dept) continue;

      const workflowDefinition = await prisma.workflowDefinition.create({
        data: {
          name: wf.name,
          description: wf.purpose,
          order: index,
          department: { connect: { id: dept.id } },
          sector: { connect: { id: childSector.id } },
        },
      });
  
      const workflowVersion = await prisma.workflowVersion.create({
        data: { workflowDefinitionId: workflowDefinition.id, versionNumber: 1, isActive: true },
      });
      
      const stageName = wf.name.includes('–') ? wf.name.split('–')[1].trim() : 'Initial Stage';
      await prisma.workflowStageDefinition.create({
        data: {
          name: stageName,
          order: 0,
          defaultTimelineDays: 5,
          percentageWeight: 100,
          workflowVersionId: workflowVersion.id,
          responsibleDepartmentId: dept.id,
          availableStatuses: JSON.stringify({ [dept.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Returned'] }),
        },
      });
    }
  };

  await seedWorkflowPath('Institutional Banking & Green Financing', 'Financial Institution', 'Director Institutional Banking and Green Financing');
  await seedWorkflowPath('Service & Mining Sectors', 'Domestic Trade and Service', 'Director Service and Mining Sector');
  await seedWorkflowPath('Manufacturing & Agriculture Sector', 'Manufacturing Industry', 'Director Manufacturing and Agricultural Sector');

  // Seed Users
  const defaultPassword = "password123";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  for (const userData of appMockUsers) {
    const finalUserId = userData.userId || userData.id;
    await prisma.user.upsert({
      where: { email: userData.email },
      update: { name: userData.name, firstName: userData.firstName, lastName: userData.lastName, phoneNumber: userData.phoneNumber, isActive: true },
      create: { id: userData.id, userId: finalUserId, name: userData.name, email: userData.email, firstName: userData.firstName, lastName: userData.lastName, phoneNumber: userData.phoneNumber, passwordHash, isPasswordChanged: false, isActive: true },
    });
  }
  
  await prisma.user.upsert({
    where: { email: 'system@loanflow.app' },
    update: {},
    create: { id: 'system-admin', userId: 'system-admin', name: 'System Admin', email: 'system@loanflow.app', phoneNumber: '0000000000', passwordHash, isPasswordChanged: true, isActive: true, customRole: { connect: { name: 'Administrator' } } }
  });

  console.log(`Seeding finished.`);
}

main().then(async () => { await prisma.$disconnect(); }).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
