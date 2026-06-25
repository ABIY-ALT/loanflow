/**
 * One-time migration: sets allowedRoles on each WF-02 stage so that
 * canCurrentUserAct correctly gates access by role (Director, Maker/Checker
 * Manager, Property Valuation Officer) rather than allowing all users in the
 * department to act on every stage.
 *
 * Run with:  npx tsx prisma/set-wf02-allowed-roles.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ROLE_MAP: Record<string, string[]> = {
  'Valuation Director':     ['Director'],
  'Valuation Maker':        ['Manager, Property Valuation (Maker)'],
  'Valuation 01-A':         ['Property Valuation Officer'],
  'Valuation Checker':      ['Manager, Property Valuation (Checker)'],
  'Valuation Checker 01-A': ['Property Valuation Officer'],
  'Valuation Finalization':  ['Manager, Property Valuation (Maker)'],
};

async function main() {
  for (const [name, roles] of Object.entries(ROLE_MAP)) {
    const updated = await prisma.workflowStageDefinition.updateMany({
      where: { name },
      data: { allowedRoles: JSON.stringify(roles) },
    });
    console.log(`  ${name} → ${JSON.stringify(roles)} (${updated.count} stage(s) updated)`);
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
