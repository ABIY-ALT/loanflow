/**
 * Migration: adds "Valuation Director" as the first WF-02 stage (order 0) in
 * EVERY WF-02 workflow version (one exists per sector / child-sector combination).
 * Also renames "Valuation 02-A" → "Valuation Checker 01-A" and shifts all other
 * existing stages up by one. Idempotent — versions that already have
 * "Valuation Director" are skipped.
 *
 * Run with:  npx tsx prisma/add-valuation-director-stage.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function processVersion(
  tx: any,
  version: { id: string; stages: any[] },
  allowedRoles: string,
) {
  const alreadyExists = version.stages.some((s: any) => s.name === 'Valuation Director');
  if (alreadyExists) {
    console.log(`  Version ${version.id}: already has "Valuation Director" — skipped`);
    return null;
  }

  const dept = version.stages[0]?.responsibleDepartment;
  if (!dept) {
    console.log(`  Version ${version.id}: no stages found — skipped`);
    return null;
  }

  // Shift existing stages up by 1 (high → low order to avoid unique-constraint collisions)
  const sorted = [...version.stages].sort((a: any, b: any) => b.order - a.order);
  for (const stage of sorted) {
    await tx.workflowStageDefinition.update({
      where: { id: stage.id },
      data: { order: stage.order + 1 },
    });
  }

  // Rename "Valuation 02-A" → "Valuation Checker 01-A"
  const old02A = version.stages.find((s: any) => s.name === 'Valuation 02-A');
  if (old02A) {
    await tx.workflowStageDefinition.update({
      where: { id: old02A.id },
      data: { name: 'Valuation Checker 01-A' },
    });
  }

  // Create "Valuation Director" at order 0
  const newStage = await tx.workflowStageDefinition.create({
    data: {
      name: 'Valuation Director',
      order: 0,
      defaultTimelineDays: 1,
      percentageWeight: 1,
      allowedRoles,
      workflowVersion: { connect: { id: version.id } },
      responsibleDepartment: { connect: { id: dept.id } },
      availableStatuses: JSON.stringify({
        [dept.name]: ['Initiated', 'In Progress', 'Completed', 'Pending', 'Not Visited', 'Returned'],
      }),
    },
  });

  console.log(`  Version ${version.id}: created "Valuation Director" (${newStage.id}), shifted ${sorted.length} stage(s)`);
  return newStage.id;
}

async function main() {
  // Find ALL WF-02 workflow definitions (one per sector)
  const wf02Defs = await prisma.workflowDefinition.findMany({
    where: { name: { contains: 'WF-02' } },
    include: {
      versions: {
        where: { isActive: true },
        include: {
          stages: {
            include: { responsibleDepartment: true },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  console.log(`Found ${wf02Defs.length} WF-02 workflow definition(s)`);

  const allowedRoles = JSON.stringify(['Director']);
  const createdStageIds: string[] = [];

  for (const def of wf02Defs) {
    for (const version of def.versions) {
      const stageId = await prisma.$transaction((tx) =>
        processVersion(tx, version, allowedRoles),
      );
      if (stageId) createdStageIds.push(stageId);
    }
  }

  if (createdStageIds.length === 0) {
    console.log('Nothing to do — all versions already have "Valuation Director".');
    return;
  }

  // Update any existing loans in PENDING valuation status to the correct stage.
  // Match by workflow version to use the right "Valuation Director" stage id.
  const pendingLoans = await prisma.loanRequest.findMany({
    where: {
      isReadyForValuation: true,
      valuationQueue: { status: 'PENDING' },
    },
    select: { id: true, loanNumber: true, workflowVersionId: true },
  });

  for (const loan of pendingLoans) {
    // Find the "Valuation Director" stage in this loan's workflow version
    const directorStage = await prisma.workflowStageDefinition.findFirst({
      where: { name: 'Valuation Director', workflowVersionId: loan.workflowVersionId },
    });
    if (!directorStage) continue;

    await prisma.loanRequest.update({
      where: { id: loan.id },
      data: { currentWorkflowStage: { connect: { id: directorStage.id } } },
    });
    console.log(`Updated loan ${loan.loanNumber} → Valuation Director stage`);
  }

  console.log(`\nDone. ${createdStageIds.length} version(s) updated, ${pendingLoans.length} PENDING loan(s) re-pointed.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
