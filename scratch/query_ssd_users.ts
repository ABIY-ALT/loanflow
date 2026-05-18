import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const ssdUsers = await prisma.user.findMany({
    where: {
      department: { name: 'Service Sector Department' }
    },
    include: {
      department: true,
      customRole: true,
      crmMappings: { include: { branch: true } }
    }
  });

  console.log(`Found ${ssdUsers.length} users in Service Sector Department.`);
  ssdUsers.forEach(u => {
    console.log(`User: ${u.name} (Email: ${u.email}), Role: ${u.customRole?.name}, District ID: ${u.districtId}`);
    u.crmMappings.forEach(m => {
      console.log(`  Mapped to branch: ${m.branch.name} (District ID: ${m.branch.districtId})`);
    });
  });

  await prisma.$disconnect();
}

run();
