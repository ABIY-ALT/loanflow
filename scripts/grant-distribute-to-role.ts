import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const roleName = 'District Analyst';
  const permission = 'DISTRIBUTE_TO_DISTRICT_APPROVAL';

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    console.error(`Role not found: ${roleName}`);
    process.exit(1);
  }

  let perms: string[] = [];
  try {
    perms = role.permissions ? JSON.parse(role.permissions) : [];
    if (!Array.isArray(perms)) perms = [];
  } catch (err) {
    console.warn('Failed to parse existing permissions, replacing with new list.');
    perms = [];
  }

  if (perms.includes(permission)) {
    console.log(`Role '${roleName}' already has '${permission}'. Nothing to do.`);
    process.exit(0);
  }

  perms.push(permission);
  const serialized = JSON.stringify(perms);

  const updated = await prisma.role.update({ where: { id: role.id }, data: { permissions: serialized } });
  console.log(`Updated role '${roleName}'.`);
  console.log('New permissions:', JSON.parse(updated.permissions));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
