'use server';

import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/app/auth/actions';
import { PERMISSIONS } from '@/lib/permissions';

import { mapPrismaLoanToAppLoan } from './utils/mappers';
import { getCommitteeSettings } from './settings-service';
import { dedupeLoanRowsBySubmission } from '@/lib/loan-submission-fingerprint';
import { releaseSubmissionDedupForLoan } from '@/services/loan-submission-guard';

const COMMITTEE_LIMIT = 20000000; // 20 million

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  if (originalError !== undefined) {
    console.error(`[CommitteeService:${context || 'Unknown'}] Error: ${message}`, originalError);
  } else {
    console.error(`[CommitteeService:${context || 'Unknown'}] Error: ${message}`);
  }
  return { error: message };
};

export async function getCommitteeQueue() {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.APPROVE_COMMITTEE_CASES)) {
      return createErrorResult("Unauthorized", "getCommitteeQueue");
    }

    const cases = await prisma.loanRequest.findMany({
      where: {
        submissionType: "TYPE2",
        currentStageStatus: "READY_FOR_COMMITTEE"
      },
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
        committeeDecisions: {
          include: {
            member: true
          }
        }
      },
      orderBy: {
        lastUpdatedDate: 'desc'
      }
    });

    const settings = await getCommitteeSettings();

    return { 
      cases: cases.map((c) => mapPrismaLoanToAppLoan(c as any)),
      settings
    };
  } catch (e: any) {
    return createErrorResult(e.message, "getCommitteeQueue");
  }
}

export async function submitCommitteeDecision(loanRequestId: string, decision: 'APPROVE' | 'REJECT', comment?: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.APPROVE_COMMITTEE_CASES)) {
      return createErrorResult("Unauthorized", "submitCommitteeDecision");
    }

    const loan = await prisma.loanRequest.findUnique({
      where: { id: loanRequestId }
    });

    if (!loan) return createErrorResult("Loan not found", "submitCommitteeDecision");

    if (loan.currentStageStatus !== "READY_FOR_COMMITTEE") {
      return createErrorResult("This case is no longer awaiting committee review.", "submitCommitteeDecision");
    }

    const settings = await getCommitteeSettings();

    // Check if user already voted or if committee is full
    const existingDecisions = await prisma.committeeDecision.findMany({
      where: { loanRequestId }
    });

    const userAlreadyVoted = existingDecisions.some(d => d.memberId === user.id);
    if (userAlreadyVoted) {
      return createErrorResult("You have already submitted a committee decision for this case.", "submitCommitteeDecision");
    }

    if (existingDecisions.length >= settings.size) {
      return createErrorResult(`Committee limit reached (${settings.size} members). No more votes can be cast.`, "submitCommitteeDecision");
    }

    // Enforce 20M limit for approval
    if (decision === 'APPROVE' && Number(loan.loanAmount) > COMMITTEE_LIMIT) {
      return createErrorResult("Approval authority capped at 20 million ETB. This case must be referred to a higher committee.", "submitCommitteeDecision");
    }

    const committeeDecision = await prisma.committeeDecision.upsert({
      where: {
        loanRequestId_memberId: {
          loanRequestId,
          memberId: user.id
        }
      },
      update: {
        decision,
        comment,
        createdAt: new Date()
      },
      create: {
        loanRequestId,
        memberId: user.id,
        decision,
        comment
      }
    });

    // Log to history
    await prisma.loanHistoryEntry.create({
      data: {
        loanRequestId,
        userId: user.id,
        stageName: "Committee Decision",
        notes: `${user.name} (${decision}) - ${comment || 'No comment'}`,
      }
    });

    // Check if enough members have decided
    const updatedDecisions = await prisma.committeeDecision.findMany({
      where: { loanRequestId }
    });

    if (updatedDecisions.length >= settings.size) {
      const approvals = updatedDecisions.filter(d => d.decision === 'APPROVE').length;
      const finalStatus = approvals >= settings.threshold ? "APPROVED" : "REJECTED";

      await prisma.$transaction(async (tx) => {
        await tx.loanRequest.update({
          where: { id: loanRequestId },
          data: {
            currentStageStatus: finalStatus,
            isTerminalStage: true,
            lastUpdatedDate: new Date(),
          },
        });
        await releaseSubmissionDedupForLoan(tx, loanRequestId);
      });

      // Log final resolution to history
      await prisma.loanHistoryEntry.create({
        data: {
          loanRequestId,
          userId: user.id, // The member who cast the final vote
          stageName: "Committee Resolution",
          notes: `Final Committee Consensus: ${finalStatus}. (Votes: ${approvals} Approve / ${updatedDecisions.length - approvals} Reject)`,
        }
      });
    }

    return { success: true, committeeDecision };
  } catch (e: any) {
    return createErrorResult(e.message, "submitCommitteeDecision");
  }
}
