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

/** Shared Prisma include for ValuationQueue → loanRequest relations used across all queue queries. */
const LOAN_INCLUDE = {
  customer: true,
  sector: { include: { parent: true } },
  requestType: true,
  assignedToUsers: { include: { department: true, customRole: true } },
  stageCompletedBy: { include: { department: true, customRole: true } },
  currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
  workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
  assignedDepartment: true,
  assignedBy: true,
  createdBy: true, // CRM who submitted the loan — used for CRM Name / Phone columns
  history: { include: { user: { include: { department: true, customRole: true } } } },
  documents: { include: { requirement: true } },
} as const;

/**
 * Maps each ValuationQueue status to the corresponding seeded WF-02 workflow stage.
 * Used to keep a Head Office (TYPE1) loan's currentWorkflowStage in sync with the
 * queue state machine so pipeline / dashboard views advance naturally. TYPE2 cases
 * stay on their single "HO Valuation Review" stage until COMPLETED and are skipped.
 */
const VALUATION_WF02_STAGE_BY_STATUS: Record<string, string> = {
  PENDING: 'Valuation Department Director',
  ASSIGNED_TO_MANAGER: 'Valuation Maker Manager',
  ASSIGNED_TO_OFFICER: 'Valuation 01-A',
  ASSIGNED_TO_CHECKER_MANAGER: 'Checker Manager',
  ASSIGNED_TO_CHECKER_OFFICER: 'Valuation Checker 01-A',
  PENDING_CHECKER_REVIEW: 'Checker Manager Review',
  PENDING_FINALIZATION: 'Valuation Maker Manager (Final Valuation Stage)',
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
  if (originalError !== undefined) {
    console.error(`[ValuationService:${context || 'Unknown'}] Error: ${message}`, originalError);
  } else {
    console.error(`[ValuationService:${context || 'Unknown'}] Error: ${message}`);
  }
  return { error: message };
};

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
        loanRequest: { include: LOAN_INCLUDE }
      },
      orderBy: { createdAt: 'desc' }
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
          updateData.makerOfficerId = assigneeId; // store for rework-to-officer routing
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
        updateData.makerOfficerId = assigneeId; // store for rework-to-officer routing
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

    // My Valuation shows only officer-stage cases directly assigned to the current user.
    // Manager-stage cases (ASSIGNED_TO_MANAGER, ASSIGNED_TO_CHECKER_MANAGER) are
    // handled in the Valuation Review page instead.
    const officerStatuses = ["ASSIGNED_TO_OFFICER", "ASSIGNED_TO_CHECKER_OFFICER"];
    const where: any = {
      assignedToId: user.id,
      status: { in: officerStatuses },
    };
    // Admins see all officer-stage cases regardless of assignee.
    if (isAdmin) delete where.assignedToId;

    const cases = await prisma.valuationQueue.findMany({
      where,
      include: {
        loanRequest: { include: LOAN_INCLUDE },
        assignedTo: true,
      },
      orderBy: { updatedAt: 'desc' }
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
    let stageName: string;

    if (queueEntry.status === "ASSIGNED_TO_OFFICER") {
      nextStatus = "ASSIGNED_TO_CHECKER_MANAGER";
      notes = `Valuation 01-A completed by ${user.fullName}. Case forwarded to Checker Manager for assignment.`;
      stageName = "Valuation Completed";
    } else if (queueEntry.status === "ASSIGNED_TO_CHECKER_OFFICER") {
      nextStatus = "PENDING_CHECKER_REVIEW";
      notes = `Verification completed by ${user.fullName}. Pending Checker Manager review.`;
      stageName = "Valuation Report Submission";
    } else {
      return createErrorResult("Case is not in a state that can be submitted by an officer.", "submitValuationReport");
    }

    await prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: nextStatus,
        assignedToId: null, // Clear per-step assignment; case enters the Checker Manager queue
      };

      await tx.valuationQueue.update({
        where: { id: queueId },
        data: updateData
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
          stageName,
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

/**
 * Valuation-specific rework: send a case directly back to the Maker Officer (Maker 01 A).
 * Available only in the Valuation Workflow from:
 *   - ASSIGNED_TO_CHECKER_MANAGER (Checker Manager — on first receipt, before assigning a Checker Officer)
 *   - ASSIGNED_TO_CHECKER_OFFICER (Checker Officer stage)
 *   - PENDING_CHECKER_REVIEW      (Checker Manager Final Review stage)
 *
 * The case is re-assigned to the officer stored in makerOfficerId and the queue
 * status reverts to ASSIGNED_TO_OFFICER so the officer sees it in their queue again.
 * After the officer re-completes the work the normal Checker chain resumes.
 */
export async function reworkToMakerOfficer(
  queueId: string,
  reason?: string,
): Promise<ValuationResult<{ success: true }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "reworkToMakerOfficer");

    const reworkReason = (reason ?? '').trim();
    if (!reworkReason) {
      return createErrorResult("A reason is required to rework the case to the Maker Officer.", "reworkToMakerOfficer");
    }

    const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);

    const queueEntry = await prisma.valuationQueue.findUnique({
      where: { id: queueId },
      include: {
        makerOfficer: true,
        loanRequest: { select: { loanNumber: true, customer: { select: { name: true } } } },
      },
    });

    if (!queueEntry) return createErrorResult("Queue entry not found", "reworkToMakerOfficer");

    // Allow: admins, Checker Managers, users with RETURN_LOAN_FOR_REWORK, or the
    // Checker Officer who is directly assigned to this case (ASSIGNED_TO_CHECKER_OFFICER).
    const isAssignedCheckerOfficer =
      queueEntry.status === "ASSIGNED_TO_CHECKER_OFFICER" && queueEntry.assignedToId === user.id;

    const canRework =
      isAdmin ||
      user.permissions.includes(PERMISSIONS.RETURN_LOAN_FOR_REWORK) ||
      isCheckerManager(user.customRoleName) ||
      isAssignedCheckerOfficer;

    if (!canRework) return createErrorResult("You are not authorized to rework to the Maker Officer.", "reworkToMakerOfficer");

    const allowedStatuses = ["ASSIGNED_TO_CHECKER_MANAGER", "ASSIGNED_TO_CHECKER_OFFICER", "PENDING_CHECKER_REVIEW"];
    if (!allowedStatuses.includes(queueEntry.status)) {
      return createErrorResult(
        "Rework to Maker Officer is only available from the Checker Manager, Checker Officer, or Checker Manager Final Review stage.",
        "reworkToMakerOfficer",
      );
    }

    if (!queueEntry.makerOfficerId) {
      return createErrorResult(
        "No Maker Officer is recorded for this case. The case may have been created before this feature was added.",
        "reworkToMakerOfficer",
      );
    }

    const officerName = queueEntry.makerOfficer?.name ?? "the assigned Maker Officer";

    await prisma.$transaction(async (tx) => {
      await tx.valuationQueue.update({
        where: { id: queueId },
        data: {
          status: "ASSIGNED_TO_OFFICER",
          assignedToId: queueEntry.makerOfficerId,
        },
      });

      // Reassign the loan to the Maker Officer so they see it in their queue.
      await tx.loanRequest.update({
        where: { id: queueEntry.loanRequestId },
        data: {
          assignedToUsers: { set: [{ id: queueEntry.makerOfficerId! }] },
        },
      });

      // Sync WF-02 stage back to Valuation 01-A (Maker Officer stage).
      await syncValuationStage(tx, queueEntry.loanRequestId, "ASSIGNED_TO_OFFICER");

      await tx.loanHistoryEntry.create({
        data: {
          loanRequestId: queueEntry.loanRequestId,
          userId: user.id,
          stageName: "Valuation Rework",
          notes: `Case reworked directly to Maker Officer (${officerName}) by ${user.fullName}. Reason: ${reworkReason}. Normal Checker chain resumes after resubmission.`,
        },
      });

      await createCaseAssignedNotifications(tx, {
        loanRequestId: queueEntry.loanRequestId,
        loanNumber: queueEntry.loanRequest.loanNumber ?? "",
        customerName: queueEntry.loanRequest.customer?.name ?? undefined,
        assigneeIds: [queueEntry.makerOfficerId!],
        assignedByUserId: user.id,
        assignedByName: user.fullName,
      });
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "reworkToMakerOfficer");
  }
}

/**
 * Valuation-specific rework: send a case back one stage in the workflow.
 * Available from:
 *   - PENDING_CHECKER_REVIEW → ASSIGNED_TO_CHECKER_OFFICER
 *   - ASSIGNED_TO_CHECKER_OFFICER → ASSIGNED_TO_CHECKER_MANAGER
 *   - ASSIGNED_TO_CHECKER_MANAGER → ASSIGNED_TO_OFFICER
 *   - ASSIGNED_TO_OFFICER → ASSIGNED_TO_MANAGER
 *   - ASSIGNED_TO_MANAGER → PENDING
 */
export async function reworkBackOneStage(
  queueId: string,
  reason?: string,
): Promise<ValuationResult<{ success: true }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "reworkBackOneStage");

    const reworkReason = (reason ?? '').trim();
    if (!reworkReason) {
      return createErrorResult("A reason is required to rework the case back one stage.", "reworkBackOneStage");
    }

    const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);

    const queueEntry = await prisma.valuationQueue.findUnique({
      where: { id: queueId },
      include: {
        loanRequest: { select: { loanNumber: true, customer: { select: { name: true } } } },
        assignedTo: true,
      },
    });

    if (!queueEntry) return createErrorResult("Queue entry not found", "reworkBackOneStage");

    // Allow: admins, Checker Managers, users with RETURN_LOAN_FOR_REWORK, or the
    // Checker Officer who is directly assigned to this case.
    const isAssignedCheckerOfficer =
      queueEntry.status === "ASSIGNED_TO_CHECKER_OFFICER" && queueEntry.assignedToId === user.id;

    const canRework =
      isAdmin ||
      user.permissions.includes(PERMISSIONS.RETURN_LOAN_FOR_REWORK) ||
      isCheckerManager(user.customRoleName) ||
      isAssignedCheckerOfficer;

    if (!canRework) return createErrorResult("You are not authorized to rework back one stage.", "reworkBackOneStage");

    // Determine the previous status based on current status
    let previousStatus: string | null = null;
    let previousAssigneeId: string | null = null;
    let stageNameForHistory: string = "";

    switch (queueEntry.status) {
      case "PENDING_CHECKER_REVIEW":
        previousStatus = "ASSIGNED_TO_CHECKER_OFFICER";
        stageNameForHistory = "Checker Officer";
        break;
      case "ASSIGNED_TO_CHECKER_OFFICER":
        previousStatus = "ASSIGNED_TO_CHECKER_MANAGER";
        stageNameForHistory = "Checker Manager";
        break;
      case "ASSIGNED_TO_CHECKER_MANAGER":
        previousStatus = "ASSIGNED_TO_OFFICER";
        if (queueEntry.makerOfficerId) previousAssigneeId = queueEntry.makerOfficerId;
        stageNameForHistory = "Maker Officer";
        break;
      case "ASSIGNED_TO_OFFICER":
        previousStatus = "ASSIGNED_TO_MANAGER";
        if (queueEntry.makerId) previousAssigneeId = queueEntry.makerId;
        stageNameForHistory = "Maker Manager";
        break;
      case "ASSIGNED_TO_MANAGER":
        previousStatus = "PENDING";
        stageNameForHistory = "Valuation Department Director";
        break;
      default:
        return createErrorResult("Cannot rework back from the current stage.", "reworkBackOneStage");
    }

    await prisma.$transaction(async (tx) => {
      const updateData: any = { status: previousStatus };
      if (previousAssigneeId) {
        updateData.assignedToId = previousAssigneeId;
      } else {
        updateData.assignedToId = null;
      }

      await tx.valuationQueue.update({
        where: { id: queueId },
        data: updateData,
      });

      // Update loan assignment if needed
      if (previousAssigneeId) {
        await tx.loanRequest.update({
          where: { id: queueEntry.loanRequestId },
          data: {
            assignedToUsers: { set: [{ id: previousAssigneeId }] },
          },
        });
      } else {
        await tx.loanRequest.update({
          where: { id: queueEntry.loanRequestId },
          data: {
            assignedToUsers: { set: [] },
          },
        });
      }

      // Sync WF-02 stage
      await syncValuationStage(tx, queueEntry.loanRequestId, previousStatus);

      await tx.loanHistoryEntry.create({
        data: {
          loanRequestId: queueEntry.loanRequestId,
          userId: user.id,
          stageName: "Valuation Rework",
          notes: `Case reworked back to ${stageNameForHistory} by ${user.fullName}. Reason: ${reworkReason}.`,
        },
      });

      // Send notification if there's an assignee
      if (previousAssigneeId) {
        const assignee = await tx.user.findUnique({
          where: { id: previousAssigneeId },
          select: { name: true },
        });
        if (assignee) {
          await createCaseAssignedNotifications(tx, {
            loanRequestId: queueEntry.loanRequestId,
            loanNumber: queueEntry.loanRequest.loanNumber ?? "",
            customerName: queueEntry.loanRequest.customer?.name ?? undefined,
            assigneeIds: [previousAssigneeId],
            assignedByUserId: user.id,
            assignedByName: user.fullName,
          });
        }
      }
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "reworkBackOneStage");
  }
}

/** Director's "Active Assignments" tab — all cases routed by current user (cases they created "Valuation Routing" for). */
export async function getValuationCasesByAssigner(): Promise<ValuationResult<{ cases: ValuationQueueItem[] }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getValuationCasesByAssigner");

    const routingHistory = await prisma.loanHistoryEntry.findMany({
      where: { userId: user.id, stageName: "Valuation Routing" },
      select: { loanRequestId: true },
      distinct: ['loanRequestId'],
    });

    const loanRequestIds = routingHistory.map(h => h.loanRequestId);
    if (loanRequestIds.length === 0) return { cases: [] };

    const cases = await prisma.valuationQueue.findMany({
      where: { loanRequestId: { in: loanRequestIds }, status: { not: "PENDING" } },
      include: {
        loanRequest: { include: LOAN_INCLUDE },
        assignedTo: { include: { customRole: true } },
      },
      orderBy: { updatedAt: 'desc' }
    });

    const mapped = cases.map(mapValuationQueueItem);
    return { cases: dedupeValuationCases(mapped) };
  } catch (e: any) {
    return createErrorResult(e.message, "getValuationCasesByAssigner");
  }
}

/**
 * Valuation Review Queue — stage-scoped per role:
 *   Maker Manager   → ASSIGNED_TO_MANAGER (assign Maker Officer) + PENDING_FINALIZATION (final approval)
 *   Checker Manager → ASSIGNED_TO_CHECKER_MANAGER (assign Checker Officer) + PENDING_CHECKER_REVIEW (final review)
 *
 * NOTE: ASSIGNED_TO_CHECKER_MANAGER cases are shown to ALL Checker Managers (unassigned queue),
 * just as the Director sees all PENDING cases. Any Checker Manager can pick up the case and
 * assign a Checker Officer for the Valuation Checker 01-A stage.
 */
export async function getValuationReviewQueue(): Promise<ValuationResult<{ cases: ValuationQueueItem[] }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getValuationReviewQueue");

    const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);
    const orConditions: any[] = [];

    if (isMakerManager(user.customRoleName) || isAdmin) {
      // Maker Manager sees cases assigned to them at manager stage, plus finalization queue
      orConditions.push({ status: "ASSIGNED_TO_MANAGER", assignedToId: user.id });
      orConditions.push({ status: "PENDING_FINALIZATION" });
    }

    if (isCheckerManager(user.customRoleName) || isAdmin) {
      // Checker Manager sees ALL cases at ASSIGNED_TO_CHECKER_MANAGER (unassigned pool —
      // no specific Checker Manager has been assigned yet; any of them can pick it up
      // and assign a Checker Officer for Valuation Checker 01-A).
      orConditions.push({ status: "ASSIGNED_TO_CHECKER_MANAGER" });
      orConditions.push({ status: "PENDING_CHECKER_REVIEW" });
    }

    if (isAdmin && orConditions.length === 0) {
      // Admin fallback: see all manager-level stages
      orConditions.push(
        { status: "ASSIGNED_TO_MANAGER" },
        { status: "ASSIGNED_TO_CHECKER_MANAGER" },
        { status: "PENDING_FINALIZATION" },
        { status: "PENDING_CHECKER_REVIEW" },
      );
    }

    if (orConditions.length === 0) return { cases: [] };

    const cases = await prisma.valuationQueue.findMany({
      where: { OR: orConditions },
      include: {
        loanRequest: { include: LOAN_INCLUDE },
        assignedTo: true,
        makerOfficer: true,
      },
      orderBy: { updatedAt: 'asc' }
    });

    const mapped = cases.map(mapValuationQueueItem);
    return { cases: dedupeValuationCases(mapped) };
  } catch (e: any) {
    return createErrorResult(e.message, "getValuationReviewQueue");
  }
}

/**
 * "Assigned By Me" tab on the Valuation Review page.
 * Returns all ValuationQueue entries for cases where the current user created a
 * "Valuation Routing" history entry (i.e., they assigned someone in the queue flow).
 */
export async function getMyAssignedValuationCases(): Promise<ValuationResult<{ cases: ValuationQueueItem[] }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getMyAssignedValuationCases");

    const routingHistory = await prisma.loanHistoryEntry.findMany({
      where: { userId: user.id, stageName: "Valuation Routing" },
      select: { loanRequestId: true },
      distinct: ['loanRequestId'],
    });

    const loanRequestIds = routingHistory.map(h => h.loanRequestId);
    if (loanRequestIds.length === 0) return { cases: [] };

    const cases = await prisma.valuationQueue.findMany({
      where: { loanRequestId: { in: loanRequestIds } },
      include: {
        loanRequest: { include: LOAN_INCLUDE },
        assignedTo: { include: { customRole: true } },
      },
      orderBy: { updatedAt: 'desc' }
    });

    const mapped = cases.map(mapValuationQueueItem);
    return { cases: dedupeValuationCases(mapped) };
  } catch (e: any) {
    return createErrorResult(e.message, "getMyAssignedValuationCases");
  }
}

/**
 * "My Cases" tab on the My Valuation page (officer history).
 * Returns all ValuationQueue entries for cases where the current officer has a
 * "Valuation Completed" history entry (i.e., they previously submitted work).
 * Visible in read-only mode so officers can track cases that have moved on.
 */
export async function getMyCompletedValuationCases(): Promise<ValuationResult<{ cases: ValuationQueueItem[] }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getMyCompletedValuationCases");

    // Match both the current stageName ("Valuation Completed") and the legacy name
    // ("Valuation Report Submission") so officers can still see older completed cases.
    const completedHistory = await prisma.loanHistoryEntry.findMany({
      where: {
        userId: user.id,
        stageName: { in: ["Valuation Completed", "Valuation Report Submission"] },
      },
      select: { loanRequestId: true },
      distinct: ['loanRequestId'],
    });

    const loanRequestIds = completedHistory.map(h => h.loanRequestId);
    if (loanRequestIds.length === 0) return { cases: [] };

    const cases = await prisma.valuationQueue.findMany({
      where: { loanRequestId: { in: loanRequestIds } },
      include: {
        loanRequest: { include: LOAN_INCLUDE },
        assignedTo: { include: { customRole: true } },
      },
      orderBy: { updatedAt: 'desc' }
    });

    const mapped = cases.map(mapValuationQueueItem);
    return { cases: dedupeValuationCases(mapped) };
  } catch (e: any) {
    return createErrorResult(e.message, "getMyCompletedValuationCases");
  }
}
