'use server';

import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/app/auth/actions';
import { PERMISSIONS } from '@/lib/permissions';
import type { ValuationQueueItem, ValuationResult, ValuationStaff } from '@/types/valuation';

import { mapPrismaLoanToAppLoan } from './utils/mappers';
import { dedupeLoansBySubmission } from '@/lib/loan-submission-fingerprint';
import { createCaseAssignedNotifications } from './notification-service';

const VALUATION_DEPT_NAME = 'Property Valuation Department';

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
        status: "PENDING",
        loanRequest: {
          submissionType: 'TYPE2' // Queue is for District Valuation
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
            status: {
              in: ["ASSIGNED_TO_MANAGER", "ASSIGNED_TO_OFFICER"]
            }
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

    // Logic: 
    // 1. Director can route PENDING cases to MANAGER or OFFICER.
    // 2. Manager (Maker) can route ASSIGNED_TO_MANAGER cases to OFFICER.
    
    let status = routingOption === 'MANAGER' ? "ASSIGNED_TO_MANAGER" : "ASSIGNED_TO_OFFICER";
    
    const updateData: any = {
      status,
      routingOption,
      assignedToId: assigneeId
    };

    // If a manager is assigning to an officer, they become the "Maker"
    if (routingOption === 'OFFICER' && (user.customRoleName?.includes('Manager') || user.customRoleName?.includes('Director'))) {
      updateData.makerId = user.id;
    }
    
    const { updated, loan } = await prisma.$transaction(async (tx) => {
      const updatedQueue = await tx.valuationQueue.update({
        where: { id: queueId },
        data: updateData
      });

      // **FIX**: Also update the loanRequest's assignedToUsers so the case is removed from incoming queue
      // This syncs the assignment from valuationQueue to loanRequest
      const updatedLoan = await tx.loanRequest.update({
        where: { id: queueEntry.loanRequestId },
        data: {
          assignedToUsers: {
            connect: { id: assigneeId }
          }
        },
        include: { customer: true }
      });

      await tx.loanHistoryEntry.create({
        data: {
          loanRequestId: queueEntry.loanRequestId,
          userId: user.id,
          stageName: "Valuation Routing",
          notes: `Case routed to ${routingOption.toLowerCase()} (${status}) and assigned to user ID ${assigneeId} by ${user.fullName}.`,
        }
      });

      // Send notification to the assignee
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

    // For testing/Admin: Show everything in the department if admin
    // Otherwise show only what's assigned to the specific user
    const where: any = {
      status: {
        in: ["ASSIGNED_TO_MANAGER", "ASSIGNED_TO_OFFICER"]
      },
      loanRequest: {
        submissionType: 'TYPE2' // "My Valuation" workspace is for District cases
      }
    };

    if (!user.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      where.assignedToId = user.id;
    }

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

    // Workflow: Officer -> Manager (Maker) -> Director
    let nextStatus = "PENDING_MANAGER_REVIEW";
    
    await prisma.valuationQueue.update({
      where: { id: queueId },
      data: {
        status: nextStatus,
        assignedToId: null, // Requirement Fix: Clear queue assignment
      }
    });

    await prisma.loanRequest.update({
      where: { id: queueEntry.loanRequestId },
      data: {
        assignedToUsers: { set: [] }, // Clear officer assignment
        currentStageStatus: "Pending Manager Review"
      }
    });

    await prisma.loanHistoryEntry.create({
      data: {
        loanRequestId: queueEntry.loanRequestId,
        userId: user.id,
        stageName: "Valuation Report Submission",
        notes: `Valuation report submitted by ${user.fullName}. Pending manager review.`,
      }
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
    // PENDING_MANAGER_REVIEW -> PENDING_DIRECTOR_REVIEW (Requires Maker approval)
    // PENDING_DIRECTOR_REVIEW -> COMPLETED (Requires Director approval)
    
    let nextStatus = queueEntry.status;
    let notes = "";

    if (queueEntry.status === "PENDING_MANAGER_REVIEW") {
      // Any manager or someone with promote permission can approve for Director review
      const isManager = user.customRoleName?.includes('Manager') || user.customRoleName?.includes('Director');
      const hasPermission = user.permissions.includes(PERMISSIONS.PROMOTE_LOAN_STAGE);
      const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);

      if (!isManager && !hasPermission && !isAdmin) {
        return createErrorResult("Only a Manager or authorized personnel can approve this report for Director review.", "approveValuationReport");
      }

      nextStatus = "PENDING_DIRECTOR_REVIEW";
      notes = `Valuation report approved by ${user.fullName}. Sent to Director review.`;
    } else if (queueEntry.status === "PENDING_DIRECTOR_REVIEW") {
      // Only Director or Admin can perform final approval
      const isDirector = user.customRoleName?.includes('Director');
      const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);

      if (!isDirector && !isAdmin) {
        return createErrorResult("Only a Department Director can perform the final valuation approval.", "approveValuationReport");
      }

      nextStatus = "COMPLETED";
      notes = `Valuation report approved by Director (${user.fullName}). Valuation completed.`;
    }

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

export async function checkValuationReport(queueId: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "checkValuationReport");

    const queueEntry = await prisma.valuationQueue.findUnique({
      where: { id: queueId }
    });

    if (!queueEntry) return createErrorResult("Queue entry not found", "checkValuationReport");

    if (queueEntry.status !== "PENDING_MANAGER_REVIEW") {
      return createErrorResult("Report is not in a state that can be checked by a Checker.", "checkValuationReport");
    }

    await prisma.valuationQueue.update({
      where: { id: queueId },
      data: { isCheckedByChecker: true }
    });

    await prisma.loanHistoryEntry.create({
      data: {
        loanRequestId: queueEntry.loanRequestId,
        userId: user.id,
        stageName: "Valuation Check",
        notes: `Valuation report checked and verified by Checker (${user.fullName}).`,
      }
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "checkValuationReport");
  }
}

export async function getValuationCasesByAssigner(): Promise<ValuationResult<{ cases: ValuationQueueItem[] }>> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getValuationCasesByAssigner");

    const cases = await prisma.valuationQueue.findMany({
      where: {
        status: {
          in: ["ASSIGNED_TO_MANAGER", "ASSIGNED_TO_OFFICER", "PENDING_MANAGER_REVIEW", "PENDING_DIRECTOR_REVIEW", "COMPLETED"]
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

    const isChecker = user.customRoleName?.includes('Checker');
    const isDirector = user.customRoleName?.includes('Director');
    const isManager = user.customRoleName?.includes('Manager');
    const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);

    const orConditions: any[] = [];

    // Managers/Makers see cases in PENDING_MANAGER_REVIEW
    // If they have promote permission, they can act as a reviewer
    if (isManager || isAdmin || user.permissions.includes(PERMISSIONS.PROMOTE_LOAN_STAGE)) {
      orConditions.push({ status: "PENDING_MANAGER_REVIEW" });
    }

    // Directors see cases in PENDING_DIRECTOR_REVIEW
    if (isDirector || isAdmin) {
      orConditions.push({ status: "PENDING_DIRECTOR_REVIEW" });
    }

    // Checkers can see cases in PENDING_MANAGER_REVIEW to mark as checked
    if (isChecker && !orConditions.some(c => c.status === "PENDING_MANAGER_REVIEW")) {
      orConditions.push({ status: "PENDING_MANAGER_REVIEW" });
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
