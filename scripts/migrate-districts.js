const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Starting user-district migration...");
    
    // Find all users with crmMappings
    const users = await prisma.user.findMany({
      include: {
        crmMappings: {
          include: {
            branch: true
          }
        }
      }
    });

    let updatedCount = 0;
    for (const user of users) {
      if (user.crmMappings && user.crmMappings.length > 0) {
        const districtId = user.crmMappings[0].branch.districtId;
        await prisma.user.update({
          where: { id: user.id },
          data: { districtId }
        });
        updatedCount++;
        console.log(`Updated user ${user.name} with district ${districtId}`);
      }
    }

    // Also handle District Managers who might not have branches but are in "District" department
    // This is a manual step for the user if they want to assign them, 
    // but for now let's at least fix the CRMs.
    
    console.log(`Finished. Updated ${updatedCount} users.`);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
