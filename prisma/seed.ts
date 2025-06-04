
import { PrismaClient, UserRole as PrismaUserRole } from '@prisma/client';
import { mockDepartments, mockUsers } from '../src/lib/mock-data';
import type { Department as AppDepartment } from '../src/types/loan'; // For type consistency

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

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

  // Seed Users (including the system user)
  console.log('Seeding Users...');
  const allUsersToSeed = [
    ...mockUsers,
    // Add the 'system-prisma' user explicitly if not in mockUsers
    {
      id: 'system-prisma',
      name: 'System Process',
      email: 'system@loanflow.app', // Ensure this email is unique
      role: PrismaUserRole.ADMIN, // Prisma's UserRole enum
      department: undefined, // System user might not belong to a department
    },
  ];

  for (const userData of allUsersToSeed) {
    let departmentDataConnect = {};
    if (userData.department) {
      const deptRecord = await prisma.department.findUnique({
        where: { nameLowercase: (userData.department as AppDepartment).toLowerCase() },
      });
      if (deptRecord) {
        departmentDataConnect = { department: { connect: { id: deptRecord.id } } };
      } else {
        console.warn(`Department "${userData.department}" not found for user "${userData.name}". User will be created without department linkage.`);
      }
    }

    // Map AppUserRole to PrismaUserRole before seeding
    let prismaRole: PrismaUserRole;
    // The 'role' in mockUsers is from 'src/types/loan.ts UserRole'
    // We need to cast/map it to Prisma's generated UserRole enum
    const appRoleKey = userData.role.toUpperCase() as keyof typeof PrismaUserRole;
    if (PrismaUserRole[appRoleKey]) {
        prismaRole = PrismaUserRole[appRoleKey];
    } else {
        console.warn(`Invalid role "${userData.role}" for user "${userData.name}". Defaulting to STAFF. Check UserRole enum consistency.`);
        prismaRole = PrismaUserRole.STAFF; // Fallback role
    }


    const user = await prisma.user.upsert({
      where: { email: userData.email }, // Using email as the unique identifier for upsert
      update: {
        name: userData.name,
        role: prismaRole,
        ...departmentDataConnect,
        // id: userData.id, // Do not update ID on existing records if email matches
      },
      create: {
        id: userData.id, // Use the mock ID for creation
        name: userData.name,
        email: userData.email,
        role: prismaRole,
        ...departmentDataConnect,
      },
    });
    console.log(`Created/updated user with id: ${user.id} (${user.name})`);
  }
  console.log('Users seeded.');

  // IMPORTANT: Seed Loan Requests, Workflow Definitions, etc.
  // This part is more complex due to relationships and requires careful handling.
  // For now, I'm focusing on Departments and Users which are common prerequisites.
  // You would expand this section to seed other entities like WorkflowDefinitions,
  // WorkflowVersions, WorkflowStageDefinitions, and then LoanRequests,
  // making sure to connect them correctly using the IDs of already seeded records.

  // Example (conceptual) for seeding workflow definitions (would need more detail):
  /*
  console.log('Seeding Workflow Definitions (Conceptual)...');
  // const sampleWorkflowDef = await prisma.workflowDefinition.create({ ... });
  // const sampleVersion = await prisma.workflowVersion.create({ data: { definitionId: sampleWorkflowDef.id, ... }});
  // const sampleStage = await prisma.workflowStageDefinition.create({ data: { versionId: sampleVersion.id, ... }});
  console.log('Workflow Definitions (Conceptual) seeded.');
  */

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
