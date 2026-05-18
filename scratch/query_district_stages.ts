import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const definitions = await prisma.workflowDefinition.findMany({
    where: {
      name: { contains: 'District', mode: 'insensitive' }
    },
    include: {
      versions: {
        include: {
          stages: {
            orderBy: { order: 'asc' }
          }
        }
      }
    }
  });

  definitions.forEach(d => {
    console.log(`Workflow Name: ${d.name}`);
    d.versions.forEach(v => {
      console.log(`  Version ${v.versionNumber} (ID: ${v.id}, Active: ${v.isActive})`);
      v.stages.forEach(s => {
        console.log(`    Stage Order ${s.order}: ${s.name} (Dept: ${s.responsibleDepartmentId})`);
      });
    });
  });

  await prisma.$disconnect();
}

run();
