import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdmin() {
  const admin = await prisma.user.findFirst({
    where: { email: 'system@loanflow.app' }
  });
  console.log('Admin User:', JSON.stringify(admin, null, 2));
  await prisma.$disconnect();
}

checkAdmin();
