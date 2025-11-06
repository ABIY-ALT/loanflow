
import { PrismaClient } from '@prisma/client';
import { mockUsers as appMockUsers, mockDepartments } from '../src/lib/mock-data'; // Using app-level mock users
import type { Department as AppDepartment } from '../src/types/loan';
import { ALL_PERMISSIONS } from '../src/lib/permissions'; // Import all permissions
import bcrypt from 'bcryptjs';

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

  // Seed Roles
  console.log('Seeding Custom Roles...');
  const viewerRole = await prisma.role.upsert({
    where: { name: 'Viewer' },
    update: {},
    create: {
      name: 'Viewer',
      description: 'Can view loan data but cannot make changes.',
      permissions: ['VIEW_DASHBOARD', 'VIEW_LOAN_PIPELINE', 'VIEW_LOAN_DETAILS', 'VIEW_LOAN_STATUS_LOOKUP'],
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
        'CREATE_LOAN_REQUEST', 'VIEW_OWN_ASSIGNED_CASES', 'EDIT_LOAN_DETAILS',
        'ADD_LOAN_NOTES', 'LOG_INFO_REQUEST', 'FULFILL_INFO_REQUEST',
        'UPLOAD_LOAN_DOCUMENTS', 'VERIFY_LOAN_DOCUMENTS', 'MARK_STAGE_COMPLETE',
        'ASSIGN_LOAN_TO_STAFF', 'FLAG_URGENT_CASE'
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


  // Seed Users
  console.log('Seeding Users...');
  const allUsersToSeed = [
    ...appMockUsers,
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
    } else if (userData.id === 'system-prisma') {
        customRoleDataConnect = { customRole: { connect: { id: adminRole.id }}};
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

    