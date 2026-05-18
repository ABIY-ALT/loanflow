const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      include: { department: true, district: true, customRole: true }
    });
    console.log("ALL USERS:", JSON.stringify(users.map(u => ({
      name: u.fullName,
      email: u.email,
      dept: u.department?.name,
      district: u.district?.name,
      districtId: u.districtId,
      role: u.customRole?.name
    })), null, 2));

    const allDistricts = await prisma.district.findMany();
    console.log("ALL DISTRICTS:", JSON.stringify(allDistricts, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
