import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  console.log('Testing Prisma connection...');
  try {
    const userCount = await prisma.user.count();
    console.log('Connection successful. User count:', userCount);
    
    const firstUser = await prisma.user.findFirst({
        include: {
            department: true,
            customRole: true,
        }
    });
    console.log('First user found:', firstUser ? firstUser.email : 'None');
    
  } catch (error) {
    console.error('Connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
