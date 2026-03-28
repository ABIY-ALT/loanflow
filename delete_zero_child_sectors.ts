import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allSectors = await prisma.sector.findMany({
    include: {
      children: true
    }
  });
  
  // Find sectors that have no children and NO parent (i.e., they are empty top-level parents)
  // Wait, the user said "0 children sector" specifically referring to the ones from their screenshot.
  // The screenshot shows: "Existing Sectors" where some have "0 children". 
  for (const s of allSectors) {
    if (s.children.length === 0 && s.parentId === null) {
      console.log(`Deleting ${s.name} which has 0 children...`);
      await prisma.sector.delete({ where: { id: s.id } });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
