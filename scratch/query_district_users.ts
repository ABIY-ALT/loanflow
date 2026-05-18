import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      department: {
        name: 'District'
      }
    },
    include: {
      department: true,
      customRole: true,
      crmMappings: { include: { branch: true } }
    }
  });

  console.log(`Found ${users.length} active users in District Department.`);
  users.forEach(u => {
    console.log(`User: ${u.name} (Email: ${u.email}), Role: ${u.customRole?.name}, District ID: ${u.districtId}`);
    u.crmMappings.forEach(m => {
      console.log(`  Mapped branch: ${m.branch.name} (District ID: ${m.branch.districtId})`);
    });
  });

  await prisma.$disconnect();
}

run();
