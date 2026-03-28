import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const names = [
    'Institutional Banking & Green Financing',
    'Manufacturing & Agriculture Sector',
    'Service & Mining Sectors',
    'Service & Mining Sector', // adding variation just in case
    'Manufacturing & Agriculture Sectors',
    'Institutional Banking & Green Financing Sector'
  ];
  
  for (const name of names) {
    try {
      const result = await prisma.sector.deleteMany({ where: { name } });
      console.log(`Deleted ${result.count} sectors matching: ${name}`);
    } catch(e: any) {
      console.error('Failed to delete', name, e.message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
