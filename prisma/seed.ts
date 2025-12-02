
import { PrismaClient } from '@prisma/client';
import { mockUsers as appMockUsers, mockDepartments } from '../src/lib/mock-data'; // Using app-level mock users
import type { Department as AppDepartment } from '../src/types/loan';
import { ALL_PERMISSIONS } from '../src/lib/permissions'; // Import all permissions
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
  console.log('Sectors seeded.');

  // --- Seed Request Types ---
  console.log('Seeding Request Types...');
  const requestTypes = ['New Loan', 'Restructuring', 'Additional Facility'];
  for (const requestTypeName of requestTypes) {
    await prisma.requestType.upsert({
      where: { name: requestTypeName },
      update: {},
      create: { name: requestTypeName },
    });
    console.log(`Created/verified request type: ${requestTypeName}`);
  }
  console.log('Request Types seeded.');


  // Seed Departments
  console.log('Seeding Departments...');
  for (const deptName of mockDepartments) {
    const department = await prisma.department.upsert({
      where: { nameLowercase: deptName.toLowerCase() },
      update: {},
      create: {
        name: deptName,
        nameLowercase: deptName.toLowerCase(),
      },
    });
    console.log(`Created/verified department with id: ${department.id} (${department.name})`);
  }
  console.log('Departments seeded.');

  // Seed Roles
  console.log('Seeding Custom Roles...');
  const viewerRole = await prisma.role.upsert({
    where: { name: 'Viewer' },
    update: {},
    create: {
      name: 'Viewer',
      description: 'Can view loan data but cannot make changes.',
      permissions: ['VIEW_DASHBOARD', 'VIEW_LOAN_PIPELINE', 'VIEW_LOAN_DETAILS', 'VIEW_LOAN_STATUS_LOOKUP', 'VIEW_CUSTOMERS'],
    },
  });
  console.log(`Created/verified role: ${viewerRole.name}`);

  const loanOfficerRole = await prisma.role.upsert({
    where: { name: 'Loan Officer' },
    update: {},
    create: {
      name: 'Loan Officer',
      description: 'Can manage assigned loan requests.',
      permissions: [
        'VIEW_DASHBOARD', 'VIEW_LOAN_PIPELINE', 'VIEW_LOAN_DETAILS', 
        'CREATE_LOAN_REQUEST', 'VIEW_OWN_ASSIGNED_CASES', 'ADD_LOAN_NOTES',
        'LOG_INFO_REQUEST', 'FULFILL_INFO_REQUEST',
        'UPLOAD_LOAN_DOCUMENTS', 'VERIFY_LOAN_DOCUMENTS', 'MARK_STAGE_COMPLETE',
        'FLAG_URGENT_CASE', 'VIEW_LOAN_STATUS_LOOKUP', 'VIEW_CUSTOMERS'
      ],
    },
  });
  console.log(`Created/verified role: ${loanOfficerRole.name}`);

  const adminRole = await prisma.role.upsert({
    where: { name: 'Administrator' },
    update: {
      permissions: ALL_PERMISSIONS,
    },
    create: {
      name: 'Administrator',
      description: 'Full access to all system features and settings.',
      permissions: ALL_PERMISSIONS,
    },
  });
  console.log(`Created/verified role: ${adminRole.name} with all permissions.`);
  console.log('Custom Roles seeded.');

  // --- Seed Workflows for Institutional Banking & Green Financing ---
  console.log('Seeding Workflows for Institutional Banking & Green Financing...');

  // Get IDs of necessary entities
  const ibgfParentSector = await prisma.sector.findUnique({
    where: { name: 'Institutional Banking & Green Financing' },
  });
  const financialInstitutionChildSector = await prisma.sector.findUnique({
    where: { name: 'Financial Institution' },
  });
  const ibgfDepartment = await prisma.department.findUnique({
    where: { nameLowercase: 'director institutional banking and green financing' },
  });
  const newLoanRequestType = await prisma.requestType.findUnique({
    where: { name: 'New Loan' },
  });

  if (!ibgfParentSector || !financialInstitutionChildSector || !ibgfDepartment || !newLoanRequestType) {
    console.error('Could not find necessary parent sector, child sector, department, or request type for workflow seeding. Aborting workflow seed.');
  } else {
    const workflowsToSeed = [
      { name: 'WF-01 – RM Request Registration (Acceptance)', order: 1, purpose: 'Initial registration and acceptance of loan requests by Relationship Managers.' },
      { name: 'WF-02 – Valuation', order: 2, purpose: 'Perform asset or collateral valuation for the loan application.' },
      { name: 'WF-03 – RM Valuation Result', order: 3, purpose: 'Record and review valuation results by the RM team.' },
      { name: 'WF-04 – Valuation Appeal (Optional Workflow)', order: 4, purpose: 'Handle appeals related to the asset valuation.' },
      { name: 'WF-05 – Appraisal', order: 5, purpose: 'Conduct comprehensive credit and risk appraisal based on valuation and financial analysis.' },
      { name: 'WF-06 – RM Disbursement', order: 6, purpose: 'Handles the initial disbursement process after appraisal.' },
      { name: 'WF-07 – Appraisal Appeal (Optional Workflow)', order: 7, purpose: 'Handle appeals related to the credit appraisal decision.' },
      { name: 'WF-08 – RM Final Disbursement (Optional Workflow)', order: 8, purpose: 'Final approval and disbursement processing by RM following successful appraisal.' },
    ];

    for (const wf of workflowsToSeed) {
      // 1. Create the Workflow Definition
      const workflowDefinition = await prisma.workflowDefinition.create({
        data: {
          name: wf.name,
          description: wf.purpose,
          order: wf.order,
          department: { connect: { id: ibgfDepartment.id } },
          sector: { connect: { id: financialInstitutionChildSector.id } },
        },
      });
      console.log(`Created Workflow Definition: ${workflowDefinition.name}`);

      // 2. Create an active version for it
      const workflowVersion = await prisma.workflowVersion.create({
        data: {
          workflowDefinition: { connect: { id: workflowDefinition.id } },
          versionNumber: 1,
          isActive: true,
        },
      });
      console.log(`  - Created active Version 1 for ${workflowDefinition.name}`);

      // 3. Create a single stage for this version
      const stageName = wf.name.split('–')[1].trim(); // Extract stage name from workflow name
      await prisma.workflowStageDefinition.create({
        data: {
          name: stageName,
          order: 0,
          defaultTimelineDays: 5, // Default timeline
          percentageWeight: 100 / workflowsToSeed.length, // Distribute weight
          workflowVersion: { connect: { id: workflowVersion.id } },
          responsibleDepartment: { connect: { id: ibgfDepartment.id } },
          availableStatuses: { [ibgfDepartment.name]: ['Initiated', 'In Progress', 'Completed'] },
        },
      });
      console.log(`    - Created stage "${stageName}" for Version 1`);
    }
    console.log('Institutional Banking & Green Financing workflows seeded.');
  }


  // Seed Users
  console.log('Seeding Users...');
  const allUsersToSeed = [
    ...appMockUsers, // This will seed the two users from mock-data.ts
    {
      id: 'system-prisma', 
      userId: 'system-prisma-identity', 
      name: 'System Process',
      email: 'system@loanflow.app',
      department: undefined, 
      customRoleName: 'Administrator', 
      firstName: 'System',
      lastName: 'Process',
      phoneNumber: '0000000000',
    },
  ];

  for (const userData of allUsersToSeed) {
    let departmentDataConnect = {};
    if (userData.department) {
      const deptName = (userData.department as AppDepartment).toLowerCase();
      const deptRecord = await prisma.department.findUnique({
        where: { nameLowercase: deptName },
      });
      if (deptRecord) {
        departmentDataConnect = { department: { connect: { id: deptRecord.id } } };
      } else {
        console.warn(`Department "${userData.department}" not found for user "${userData.name}".`);
      }
    }
    
    let customRoleDataConnect = {};
    if (userData.customRoleName) {
        const roleRecord = await prisma.role.findUnique({
            where: { name: userData.customRoleName },
        });
        if (roleRecord) {
            customRoleDataConnect = { customRole: { connect: { id: roleRecord.id }}};
        } else {
            console.warn(`Custom Role "${userData.customRoleName}" not found for user "${userData.name}".`);
        }
    }

    const defaultPassword = "password123";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const finalUserId = userData.userId || userData.id;

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        name: userData.name,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        userId: finalUserId,
        passwordHash: passwordHash,
        isPasswordChanged: false, // Set to true so they don't need to change password
        failedLoginAttempts: 0,
        lockoutUntil: null,
        ...departmentDataConnect,
        ...customRoleDataConnect,
      },
      create: {
        id: userData.id, 
        userId: finalUserId,
        name: userData.name,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        passwordHash: passwordHash,
        isPasswordChanged: false, // Set to true so they don't need to change password
        ...departmentDataConnect,
        ...customRoleDataConnect,
      },
    });
    console.log(`Created/updated user with id: ${user.id} (${user.name}), customRoleID: ${user.customRoleId}`);
  }
  console.log('Users seeded.');
  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
