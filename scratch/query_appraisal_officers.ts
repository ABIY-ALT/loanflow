import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    where: {
      customRole: {
        name: { contains: 'Appraisal' }
      }
    },
    include: {
      department: true,
      customRole: true,
      crmMappings: { include: { branch: true } }
    }
  });

  console.log(`Found ${users.length} Appraisal Officers.`);
  users.forEach(u => {
    console.log(`User: ${u.name} (Email: ${u.email}), Dept: ${u.department?.name}, District ID: ${u.districtId}`);
    u.crmMappings.forEach(m => {
      console.log(`  Mapped branch: ${m.branch.name} (District ID: ${m.branch.districtId})`);
    });
  });

  await prisma.$disconnect();
}

run();
