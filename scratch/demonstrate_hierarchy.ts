import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mocking roleMatches for the demonstration
function normalizeRoutingName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

function roleMatches(roleName: string | null | undefined, tokens: string[]) {
  const normalizedRole = normalizeRoutingName(roleName);
  return tokens.some((token) => normalizedRole.includes(normalizeRoutingName(token)));
}

async function demonstrateHierarchy() {
  console.log('--- Demonstrating Department Routing Hierarchy ---');

  // 1. Pick a department with both Chief and Director if possible
  const depts = await prisma.department.findMany({
    include: {
      users: {
        include: { customRole: true }
      }
    }
  });

  for (const dept of depts) {
    const deptUsers = dept.users.filter(u => u.isActive);
    const hasChief = deptUsers.some(u => roleMatches(u.customRole?.name, ['Chief', 'Deputy Chief']));
    const hasDirector = deptUsers.some(u => roleMatches(u.customRole?.name, ['Director']));

    console.log(`\nDepartment: ${dept.name}`);
    console.log(`- Has Chief/Deputy Chief: ${hasChief ? '✅' : '❌'}`);
    console.log(`- Has Director: ${hasDirector ? '✅' : '❌'}`);

    // Simulate getIncomingLoanRequests logic for different roles
    const testRoles = ['Chief', 'Director', 'Manager', 'CRM'];
    
    for (const roleName of testRoles) {
      const isChief = roleMatches(roleName, ['Chief', 'Deputy Chief']);
      const isDirector = roleMatches(roleName, ['Director']);

      let visibility = 'Allowed';
      let reason = '';

      if (hasChief && !isChief) {
        visibility = 'Blocked';
        reason = 'A Chief exists in the department. Only the Chief can see incoming cases.';
      } else if (!hasChief && hasDirector && !isDirector) {
        visibility = 'Blocked';
        reason = 'No Chief exists, but a Director exists. Only the Director can see incoming cases.';
      } else {
        visibility = 'Allowed';
        reason = 'User is the highest available authority in the hierarchy.';
      }

      console.log(`  Role [${roleName}]: ${visibility === 'Allowed' ? '👀 Visible' : '🚫 Hidden'} - ${reason}`);
    }
  }

  await prisma.$disconnect();
}

demonstrateHierarchy();
