import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPhone() {
  const users = await prisma.user.findMany({
    where: { phoneNumber: '0000000000' }
  });
  console.log('Users with 0000000000:', JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

checkPhone();
