import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

function parseArg(name: string) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  if (!arg) return null;
  return arg.split('=')[1];
}

async function main() {
  const email = parseArg('email');
  const id = parseArg('id');
  if (!email && !id) {
    console.error('Usage: npx tsx scripts/grant-role-to-user.ts --email=you@org.com OR --id=<userId>');
    process.exit(1);
  }

  const roleName = 'District Analyst';
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    console.error(`Role not found: ${roleName}`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: email ? { email } : { id } });
  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  if (user.customRoleId === role.id) {
    console.log(`User ${user.email} already has role '${roleName}'.`);
    process.exit(0);
  }

  await prisma.user.update({ where: { id: user.id }, data: { customRoleId: role.id } });
  console.log(`Assigned role '${roleName}' to user ${user.email}.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
