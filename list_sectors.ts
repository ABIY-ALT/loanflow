import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sectors = await prisma.sector.findMany({ where: { parentId: null } });
  console.log('Current parent sectors:');
  sectors.forEach(s => console.log(s.name));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
