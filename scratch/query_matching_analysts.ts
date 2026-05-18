import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      department: {
        name: "District"
      },
      customRole: {
        OR: [
          { name: { contains: "Analyst", mode: "insensitive" } },
          { name: { contains: "Appraisal", mode: "insensitive" } },
          { name: { contains: "anays", mode: "insensitive" } },
        ]
      }
    },
    include: {
      department: true,
      customRole: true,
      crmMappings: { include: { branch: true } }
    }
  });

  console.log(`Found ${users.length} matching District Analysts.`);
  users.forEach(u => {
    console.log(`User: ${u.name} (Email: ${u.email}), Dept: ${u.department?.name}, District ID: ${u.districtId}`);
    u.crmMappings.forEach(m => {
      console.log(`  Mapped branch: ${m.branch.name} (District ID: ${m.branch.districtId})`);
    });
  });

  await prisma.$disconnect();
}

run();
