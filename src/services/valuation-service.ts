'use server';

import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/app/auth/actions';
import { PERMISSIONS } from '@/lib/permissions';
import type { ValuationQueueItem, ValuationResult, ValuationStaff } from '@/types/valuation';
import { ACTIVE_ASSIGNMENT_STATUSES } from '@/types/valuation';

import { mapPrismaLoanToAppLoan } from './utils/mappers';
import { dedupeLoansBySubmission } from '@/lib/loan-submission-fingerprint';
import { createCaseAssignedNotifications } from './notification-service';

const VALUATION_DEPT_NAME = 'Property Valuation Department';

/**
 * Maps each ValuationQueue status to the corresponding seeded WF-02 workflow stage.
 * Used to keep a Head Office (TYPE1) loan's currentWorkflowStage in sync with the
 * queue state machine so pipeline / dashboard views advance naturally. TYPE2 cases
 * stay on their single "HO Valuation Review" stage until COMPLETED and are skipped.
 */
const VALUATION_WF02_STAGE_BY_STATUS: Record<string, string> = {
  PENDING: 'Valuation Maker',
  ASSIGNED_TO_MANAGER: 'Valuation Maker',
  ASSIGNED_TO_OFFICER: 'Valuation 01-A',
  ASSIGNED_TO_CHECKER_MANAGER: 'Valuation Checker',
  ASSIGNED_TO_CHECKER_OFFICER: 'Valuation 02-A',
  PENDING_CHECKER_REVIEW: 'Valuation 02-A',
  PENDING_FINALIZATION: 'Valuation Finalization',
};

async function syncValuationStage(tx: any, loanRequestId: string, status: string) {
  const stageName = VALUATION_WF02_STAGE_BY_STATUS[status];
  if (!stageName) return;

  const loan = await tx.loanRequest.findUnique({
    where: { id: loanRequestId },
    select: {
      submissionType: true,
      workflowVersion: { select: { stages: { include: { responsibleDepartment: true } } } },
    },
  });

  // Only Head Office (TYPE1) has the 5 granular WF-02 stages to mirror.
  if (!loan || loan.submissionType !== 'TYPE1') return;

  const stage = loan.workflowVersion?.stages.find((s: any) => s.name === stageName);
  if (!stage) return;

  const now = new Date();
  await tx.loanRequest.update({
    where: { id: loanRequestId },
    data: {
      currentWorkflowStage: { connect: { id: stage.id } },
      assignedDepartment: { connect: { id: stage.responsibleDepartmentId } },
      stageEntryDate: now,
      stageDeadline: new Date(now.getTime() + stage.defaultTimelineDays * 24 * 60 * 60 * 1000),
    },
  });
}

// Role predicates based on the seeded custom-role names (see prisma/seed.ts).
const isMakerManager = (roleName?: string | null) => !!roleName?.includes('Manager') && !!roleName?.includes('Maker');
const isCheckerManager = (roleName?: string | null) => !!roleName?.includes('Manager') && !!roleName?.includes('Checker');
const isDirectorRole = (roleName?: string | null) => !!roleName?.includes('Director');

/**
 * Helper to map valuation queue items and their nested loans
 */
function mapValuationQueueItem(item: any): ValuationQueueItem {
  return {
    ...item,
    loanRequest: mapPrismaLoanToAppLoan(item.loanRequest as any),
  };
}

function dedupeValuationCases(items: ValuationQueueItem[]) {
  const uniqueLoans = dedupeLoansBySubmission(items.map((it) => it.loanRequest));
  const loanIdOrder = new Map(uniqueLoans.map((loan, index) => [loan.id, index]));
  return items
    .filter((it) => loanIdOrder.has(it.loanRequest.id))
    .sort(
      (a, b) =>
        (loanIdOrder.get(a.loanRequest.id) ?? 0) - (loanIdOrder.get(b.loanRequest.id) ?? 0),
    );
}

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  console.error(`[ValuationService:${context || 'Unknown'}] Error: ${message}`, originalError);
  return { error: message };
}

export async function getIncomingValuationCases(): Promise<ValuationResult<{ cases: ValuationQueueItem[] }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getIncomingValuationCases");

    // Check if user is in Valuation Department and has VIEW_INCOMING_CASES permission
    // Or if they are admin
    const isValuationDept = user.department === VALUATION_DEPT_NAME;
    const canView =
      user.permissions.includes(PERMISSIONS.VIEW_INCOMING_CASES) ||
      user.permissions.includes(PERMISSIONS.VIEW_DISTRICT_VALUATION) ||
      user.permissions.includes(PERMISSIONS.MANAGE_USERS);

    if (!canView) return createErrorResult("Unauthorized", "getIncomingValuationCases");

    const cases = await prisma.valuationQueue.findMany({
      where: {
        status: "PENDING", // Director's incoming queue, both Head Office and District
      },
      include: {
        loanRequest: {
          include: {
            customer: true,
            sector: { include: { parent: true } },
            requestType: true,
            assignedToUsers: { include: { department: true, customRole: true } },
            stageCompletedBy: { include: { department: true, customRole: true } },
            currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
            workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
            assignedDepartment: true,
            assignedBy: true,
            history: { include: { user: { include: { department: true, customRole: true } } } },
            documents: { include: { requirement: true } },
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const mapped = cases.map(mapValuationQueueItem);
    return { cases: dedupeValuationCases(mapped) };
  } catch (e: any) {
    return createErrorResult(e.message, "getIncomingValuationCases");
  }
}

export async function getValuationDeptStaff(): Promise<ValuationResult<{ staff: ValuationStaff[] }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getValuationDeptStaff");

    const dept = await prisma.department.findUnique({
      where: { name: VALUATION_DEPT_NAME }
    });

    if (!dept) return createErrorResult("Valuation department not found", "getValuationDeptStaff");

    const staff = await prisma.user.findMany({
      where: {
        departmentId: dept.id,
        isActive: true
      },
      include: {
        customRole: true,
        valuationAssignments: {
          where: {
            status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] }
          }
        }
      }
    });

    return { staff: staff as unknown as ValuationStaff[] };
  } catch (e: any) {
    return createErrorResult(e.message, "getValuationDeptStaff");
  }
}

export async function routeValuationCase(
  queueId: string,
  routingOption: 'MANAGER' | 'OFFICER',
  assigneeId: string
): Promise<ValuationResult<{ success: true; updated: unknown }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "routeValuationCase");

    const queueEntry = await prisma.valuationQueue.findUnique({
      where: { id: queueId },
      include: { assignedTo: { include: { customRole: true } } }
    });

    if (!queueEntry) return createErrorResult("Queue entry not found", "routeValuationCase");

    // The next status is driven by the current status (and, from PENDING, the
    // Director's chosen routing option):
    //   PENDING                      -> ASSIGNED_TO_MANAGER          (Director picks a Maker Manager)
    //   PENDING + OFFICER            -> ASSIGNED_TO_OFFICER          (Director assigns an Officer directly
    //                                                                 when no Maker Manager is available)
    //   ASSIGNED_TO_MANAGER          -> ASSIGNED_TO_OFFICER          (Maker Manager picks a Maker Officer)
    //   ASSIGNED_TO_CHECKER_MANAGER  -> ASSIGNED_TO_CHECKER_OFFICER  (Checker Manager picks a Checker Officer)
    const updateData: any = { assignedToId: assigneeId };
    let nextStatus: string;
    let routeLabel: string;

    switch (queueEntry.status) {
      case "PENDING":
        if (routingOption === "OFFICER") {
          // Maker Manager unavailable: the Director hands the case straight to a
          // Maker Officer. It skips ASSIGNED_TO_MANAGER and lands at Valuation 01-A,
          // then continues through the normal Checker chain. The Director stands in
          // as the Maker owner so a Maker Manager can still finalize later.
          nextStatus = "ASSIGNED_TO_OFFICER";
          routeLabel = "Maker Officer (direct)";
          updateData.routingOption = "OFFICER";
          updateData.makerId = user.id;
        } else {
          nextStatus = "ASSIGNED_TO_MANAGER";
          routeLabel = "Maker Manager";
          updateData.routingOption = "MANAGER";
          updateData.makerId = assigneeId;
        }
        break;
      case "ASSIGNED_TO_MANAGER":
        nextStatus = "ASSIGNED_TO_OFFICER";
        routeLabel = "Maker Officer";
        updateData.routingOption = "OFFICER";
        if (!queueEntry.makerId) updateData.makerId = user.id;
        break;
      case "ASSIGNED_TO_CHECKER_MANAGER":
        nextStatus = "ASSIGNED_TO_CHECKER_OFFICER";
        routeLabel = "Checker Officer";
        updateData.routingOption = "OFFICER";
        break;
      default:
        return createErrorResult("Case is not in a routable state.", "routeValuationCase");
    }

    updateData.status = nextStatus;

    const { updated } = await prisma.$transaction(async (tx) => {
      const updatedQueue = await tx.valuationQueue.update({
        where: { id: queueId },
        data: updateData
      });

      // Mirror the assignment onto the loanRequest so the case follows the assignee.
      const updatedLoan = await tx.loanRequest.update({
        where: { id: queueEntry.loanRequestId },
        data: {
          assignedToUsers: { set: [{ id: assigneeId }] }
        },
        include: { customer: true }
      });

      // Keep the Head Office WF-02 stage in sync with the queue status.
      await syncValuationStage(tx, queueEntry.loanRequestId, nextStatus);

      await tx.loanHistoryEntry.create({
        data: {
          loanRequestId: queueEntry.loanRequestId,
          userId: user.id,
          stageName: "Valuation Routing",
          notes: `Case routed to ${routeLabel} by ${user.fullName}.`,
        }
      });

      await createCaseAssignedNotifications(tx, {
        loanRequestId: updatedLoan.id,
        loanNumber: updatedLoan.loanNumber,
        customerName: updatedLoan.customer.name,
        assigneeIds: [assigneeId],
        assignedByUserId: user.id,
        assignedByName: user.fullName,
      });

      return { updated: updatedQueue, loan: updatedLoan };
    });

    return { success: true, updated };
  } catch (e: any) {
    return createErrorResult(e.message, "routeValuationCase");
  }
}

export async function getValuationCaseload() {
  try {
    const staffResult = await getValuationDeptStaff();
    if ('error' in staffResult) return [];
    const { staff } = staffResult;

    return staff.map(s => ({
      id: s.id,
      name: s.name,
      role: s.customRole?.name,
      activeCases: s.valuationAssignments.length
    })).sort((a, b) => a.activeCases - b.activeCases);
  } catch (e: any) {
    console.error(e);
    return [];
  }
}

export async function getMyValuationCases(): Promise<ValuationResult<{ cases: ValuationQueueItem[] }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getMyValuationCases");
    const canView =
      user.permissions.includes(PERMISSIONS.VIEW_MY_VALUATION_CASES) ||
      user.permissions.includes(PERMISSIONS.MANAGE_USERS);
    if (!canView) return createErrorResult("Unauthorized", "getMyValuationCases");

    const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);

    // A user sees:
    //   - cases directly assigned to them that are in an active assignment status
    //   - if they are a Checker Manager (or admin), the unassigned Checker-Manager queue
    const orConditions: any[] = [
      { assignedToId: user.id, status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] } },
    ];

    if (isCheckerManager(user.customRoleName) || isAdmin) {
      orConditions.push({ status: "ASSIGNED_TO_CHECKER_MANAGER" });
    }

    const where: any = { OR: orConditions };

    const cases = await prisma.valuationQueue.findMany({
      where,
      include: {
        loanRequest: {
          include: {
            customer: true,
            sector: { include: { parent: true } },
            requestType: true,
            assignedToUsers: { include: { department: true, customRole: true } },
            stageCompletedBy: { include: { department: true, customRole: true } },
            currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
            workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
            assignedDepartment: true,
            assignedBy: true,
            history: { include: { user: { include: { department: true, customRole: true } } } },
            documents: { include: { requirement: true } },
          }
        },
        assignedTo: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    const mapped = cases.map(mapValuationQueueItem);
    return { cases: dedupeValuationCases(mapped) };
  } catch (e: any) {
    return createErrorResult(e.message, "getMyValuationCases");
  }
}

export async function submitValuationReport(queueId: string, reportData: any) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "submitValuationReport");

    const queueEntry = await prisma.valuationQueue.findUnique({
      where: { id: queueId },
      include: { assignedTo: { include: { customRole: true } } }
    });

    if (!queueEntry) return createErrorResult("Queue entry not found", "submitValuationReport");

    // Officer submissions advance per current status:
    //   ASSIGNED_TO_OFFICER          -> ASSIGNED_TO_CHECKER_MANAGER  (hand to the Checker queue)
    //   ASSIGNED_TO_CHECKER_OFFICER  -> PENDING_CHECKER_REVIEW       (Checker Manager final review)
    let nextStatus: string;
    let notes: string;

    if (queueEntry.status === "ASSIGNED_TO_OFFICER") {
      nextStatus = "ASSIGNED_TO_CHECKER_MANAGER";
      notes = `Valuation completed by ${user.fullName}. Forwarded to the Checker queue.`;
    } else if (queueEntry.status === "ASSIGNED_TO_CHECKER_OFFICER") {
      nextStatus = "PENDING_CHECKER_REVIEW";
      notes = `Verification completed by ${user.fullName}. Pending Checker Manager review.`;
    } else {
      return createErrorResult("Case is not in a state that can be submitted by an officer.", "submitValuationReport");
    }

    await prisma.$transaction(async (tx) => {
      await tx.valuationQueue.update({
        where: { id: queueId },
        data: {
          status: nextStatus,
          assignedToId: null, // Clear per-step assignment; case becomes a queue item
        }
      });

      await tx.loanRequest.update({
        where: { id: queueEntry.loanRequestId },
        data: { assignedToUsers: { set: [] } }
      });

      await syncValuationStage(tx, queueEntry.loanRequestId, nextStatus);

      await tx.loanHistoryEntry.create({
        data: {
          loanRequestId: queueEntry.loanRequestId,
          userId: user.id,
          stageName: "Valuation Report Submission",
          notes,
        }
      });
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "submitValuationReport");
  }
}

export async function approveValuationReport(queueId: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "approveValuationReport");

    const queueEntry = await prisma.valuationQueue.findUnique({
      where: { id: queueId }
    });

    if (!queueEntry) return createErrorResult("Queue entry not found", "approveValuationReport");

    // Workflow transitions:
    //   PENDING_CHECKER_REVIEW -> PENDING_FINALIZATION  (Checker Manager approves the verification)
    //   PENDING_FINALIZATION   -> COMPLETED             (Maker Manager finalizes the valuation)
    const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);
    let nextStatus = queueEntry.status;
    let notes = "";

    if (queueEntry.status === "PENDING_CHECKER_REVIEW") {
      const allowed = isCheckerManager(user.customRoleName) || user.permissions.includes(PERMISSIONS.PROMOTE_LOAN_STAGE) || isAdmin;
      if (!allowed) {
        return createErrorResult("Only a Checker Manager can approve the verification.", "approveValuationReport");
      }
      nextStatus = "PENDING_FINALIZATION";
      notes = `Verification approved by ${user.fullName}. Sent to the Maker Manager for finalization.`;
    } else if (queueEntry.status === "PENDING_FINALIZATION") {
      const allowed = isMakerManager(user.customRoleName) || isAdmin;
      if (!allowed) {
        return createErrorResult("Only the Maker Manager can finalize the valuation.", "approveValuationReport");
      }
      nextStatus = "COMPLETED";
      notes = `Valuation finalized by ${user.fullName}. Valuation completed.`;
    } else {
      return createErrorResult("Case is not in a state that can be approved.", "approveValuationReport");
    }

    await syncValuationStage(prisma, queueEntry.loanRequestId, nextStatus);

    await prisma.valuationQueue.update({
      where: { id: queueId },
      data: { status: nextStatus }
    });

    await prisma.loanHistoryEntry.create({
      data: {
        loanRequestId: queueEntry.loanRequestId,
        userId: user.id,
        stageName: "Valuation Approval",
        notes: notes || `Valuation report approved by ${user.fullName}.`,
      }
    });

    // If completed, return case to the original sender (CRM / loan officer).
    if (nextStatus === "COMPLETED") {
      const forwardingEvent = await prisma.loanHistoryEntry.findFirst({
        where: {
          loanRequestId: queueEntry.loanRequestId,
          stageName: "Forward to Valuation",
        },
        orderBy: { timestamp: "desc" },
        select: { userId: true },
      });

      const loanMeta = await prisma.loanRequest.findUnique({
        where: { id: queueEntry.loanRequestId },
        select: {
          id: true,
          loanNumber: true,
          createdById: true,
          sectorId: true,
          submissionType: true,
          currentStageId: true,
          workflowVersion: {
            select: {
              id: true,
              workflowDefinition: {
                select: { id: true, order: true, name: true },
              },
              stages: {
                orderBy: { order: 'asc' },
                include: { responsibleDepartment: true }
              }
            },
          },
        },
      });

      const returnUserId = forwardingEvent?.userId || loanMeta?.createdById || null;

      let returnUser: { id: string; name: string | null; departmentId: string | null; isActive: boolean } | null = null;
      if (returnUserId) {
        returnUser = await prisma.user.findUnique({
          where: { id: returnUserId },
          select: { id: true, name: true, departmentId: true, isActive: true },
        });
      }

      const returnTargetName = returnUser?.name || "original sender";
      const updatePayload: any = {
        isValuationCompleted: true,
        lastUpdatedDate: new Date(),
        currentStageStatus: "RETURNED_FROM_VALUATION",
        history: {
          create: {
            userId: user.id,
            stageName: "Valuation Return",
            notes: `Valuation completed and case returned to ${returnTargetName} by ${user.fullName}.`,
          },
        },
      };

      if (returnUser?.departmentId) {
        updatePayload.assignedDepartment = { connect: { id: returnUser.departmentId } };
      }

      if (returnUser?.isActive) {
        updatePayload.assignedToUsers = { set: [{ id: returnUser.id }] };
      }

      // Logic Fix: Handle Head Office vs District routing after valuation
      if (loanMeta?.submissionType === 'TYPE2') {
        // District Workflow: Stay in the same workflow, move to the next stage
        const currentStages = loanMeta.workflowVersion?.stages || [];
        const currentStageIdx = currentStages.findIndex(s => s.id === loanMeta.currentStageId);
        
        if (currentStageIdx !== -1 && currentStageIdx < currentStages.length - 1) {
          const nextStage = currentStages[currentStageIdx + 1];
          updatePayload.currentWorkflowStage = { connect: { id: nextStage.id } };
          updatePayload.assignedDepartment = { connect: { id: nextStage.responsibleDepartmentId } };
          updatePayload.stageEntryDate = new Date();
          updatePayload.stageDeadline = new Date(Date.now() + nextStage.defaultTimelineDays * 24 * 60 * 60 * 1000);
          updatePayload.currentStageStatus = "Initiated";
        }
      } else {
        // Head Office Workflow: Original logic (return to sender or move to next workflow if defined)
        // For HO, usually we return to the next stage in the SAME workflow first.
        const currentStages = loanMeta?.workflowVersion?.stages || [];
        const currentStageIdx = currentStages.findIndex(s => s.id === loanMeta?.currentStageId);

        if (currentStageIdx !== -1 && currentStageIdx < currentStages.length - 1) {
          const nextStage = currentStages[currentStageIdx + 1];
          updatePayload.currentWorkflowStage = { connect: { id: nextStage.id } };
          updatePayload.assignedDepartment = { connect: { id: nextStage.responsibleDepartmentId } };
          updatePayload.stageEntryDate = new Date();
          updatePayload.stageDeadline = new Date(Date.now() + nextStage.defaultTimelineDays * 24 * 60 * 60 * 1000);
          updatePayload.currentStageStatus = "Initiated";
        } else {
          // If it was the last stage of the current HO workflow, look for the next one in sequence
          const currentWorkflowOrder = loanMeta?.workflowVersion?.workflowDefinition?.order ?? 0;
          const nextWorkflow = await prisma.workflowDefinition.findFirst({
            where: {
              sectorId: loanMeta?.sectorId,
              order: { gt: currentWorkflowOrder },
              NOT: [
                { name: { contains: "Appeal", mode: "insensitive" } },
                { name: { contains: "Optional", mode: "insensitive" } },
              ],
            },
            orderBy: { order: "asc" },
            include: {
              versions: {
                where: { isActive: true },
                take: 1,
                include: {
                  stages: {
                    orderBy: { order: "asc" },
                    include: { responsibleDepartment: true },
                  },
                },
              },
            },
          });

          const nextVersion = nextWorkflow?.versions[0];
          const nextStage = nextVersion?.stages[0];
          if (nextVersion && nextStage) {
            updatePayload.workflowVersion = { connect: { id: nextVersion.id } };
            updatePayload.currentWorkflowStage = { connect: { id: nextStage.id } };
            updatePayload.assignedDepartment = { connect: { id: nextStage.responsibleDepartmentId } };
            updatePayload.stageEntryDate = new Date();
            updatePayload.stageDeadline = new Date(Date.now() + nextStage.defaultTimelineDays * 24 * 60 * 60 * 1000);
            updatePayload.currentStageStatus = "Initiated";
          }
        }
      }

      await prisma.loanRequest.update({
        where: { id: queueEntry.loanRequestId },
        data: updatePayload,
      });
    }

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "approveValuationReport");
  }
}

export async function getValuationCasesByAssigner(): Promise<ValuationResult<{ cases: ValuationQueueItem[] }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getValuationCasesByAssigner");

    const cases = await prisma.valuationQueue.findMany({
      where: {
        status: {
          in: [...ACTIVE_ASSIGNMENT_STATUSES, "PENDING_CHECKER_REVIEW", "PENDING_FINALIZATION", "COMPLETED"]
        }
      },
      include: {
        loanRequest: {
          include: {
            customer: true,
            sector: { include: { parent: true } },
            requestType: true,
            assignedToUsers: { include: { department: true, customRole: true } },
            stageCompletedBy: { include: { department: true, customRole: true } },
            currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
            workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
            assignedDepartment: true,
            assignedBy: true,
            history: { include: { user: { include: { department: true, customRole: true } } } },
            documents: { include: { requirement: true } },
          }
        },
        assignedTo: {
          include: {
            customRole: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    const mapped = cases.map(mapValuationQueueItem);
    return { cases: dedupeValuationCases(mapped) };
  } catch (e: any) {
    return createErrorResult(e.message, "getValuationCasesByAssigner");
  }
}

export async function getValuationReviewQueue(): Promise<ValuationResult<{ cases: ValuationQueueItem[] }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getValuationReviewQueue");

    const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);
    const canPromote = user.permissions.includes(PERMISSIONS.PROMOTE_LOAN_STAGE);

    const orConditions: any[] = [];

    // Checker Managers do the final verification review.
    if (isCheckerManager(user.customRoleName) || isAdmin || canPromote) {
      orConditions.push({ status: "PENDING_CHECKER_REVIEW" });
    }

    // Maker Managers finalize the valuation.
    if (isMakerManager(user.customRoleName) || isAdmin) {
      orConditions.push({ status: "PENDING_FINALIZATION" });
    }

    if (orConditions.length === 0) return { cases: [] };

    const cases = await prisma.valuationQueue.findMany({
      where: {
        OR: orConditions
      },
      include: {
        loanRequest: {
          include: {
            customer: true,
            sector: { include: { parent: true } },
            requestType: true,
            assignedToUsers: { include: { department: true, customRole: true } },
            stageCompletedBy: { include: { department: true, customRole: true } },
            currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
            workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
            assignedDepartment: true,
            assignedBy: true,
            history: { include: { user: { include: { department: true, customRole: true } } } },
            documents: { include: { requirement: true } },
          }
        },
        assignedTo: true
      },
      orderBy: {
        updatedAt: 'asc'
      }
    });

    const mapped = cases.map(mapValuationQueueItem);
    return { cases: dedupeValuationCases(mapped) };
  } catch (e: any) {
    return createErrorResult(e.message, "getValuationReviewQueue");
  }
}
