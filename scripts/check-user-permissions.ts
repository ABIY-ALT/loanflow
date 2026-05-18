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
    console.error('Usage: npx tsx scripts/check-user-permissions.ts --email=you@org.com OR --id=<userId>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: email ? { email } : { id },
    include: { customRole: true },
  });

  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  console.log('User: ', { id: user.id, email: user.email, name: user.name });
  if (!user.customRole) {
    console.log('No custom role assigned to this user.');
    process.exit(0);
  }

  console.log('Role:', { id: user.customRole.id, name: user.customRole.name });
  let perms: string[] = [];
  try {
    perms = user.customRole.permissions ? JSON.parse(user.customRole.permissions) : [];
  } catch (e) {
    console.warn('Failed to parse role permissions JSON');
  }
  console.log('Permissions:', perms);
  console.log('Has DISTRIBUTE_TO_DISTRICT_APPROVAL:', perms.includes('DISTRIBUTE_TO_DISTRICT_APPROVAL'));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
