import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const workflows = await prisma.workflowDefinition.findMany({
    include: {
      versions: {
        include: {
          stages: {
            orderBy: { order: 'asc' },
            include: { responsibleDepartment: true }
          }
        }
      }
    }
  });

  workflows.forEach(w => {
    console.log(`Workflow: ${w.name}`);
    w.versions.forEach(v => {
      console.log(`  Version: ${v.versionNumber} (Active: ${v.isActive})`);
      v.stages.forEach(s => {
        console.log(`    Stage ${s.order}: ${s.name} (Dept: ${s.responsibleDepartment.name})`);
      });
    });
  });

  await prisma.$disconnect();
}

run();
