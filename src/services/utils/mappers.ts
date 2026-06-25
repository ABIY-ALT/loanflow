import type {
  LoanRequest as PrismaLoanRequest,
  WorkflowDefinition as PrismaWorkflowDefinition,
  WorkflowVersion as PrismaWorkflowVersion,
  WorkflowStageDefinition as PrismaWorkflowStageDefinition,
  Department as PrismaDepartment,
  User as PrismaUser,
  LoanDocument as PrismaLoanDocument,
  LoanHistoryEntry as PrismaLoanHistoryEntry,
  Role as PrismaRole,
  Sector as PrismaSector,
  RequestType as PrismaRequestType,
  DocumentRequirement as PrismaDocumentRequirement,
  Customer as PrismaCustomer,
} from '@prisma/client';

import type { LoanRequest, User, Department, LoanHistoryEntry } from '@/types/loan';
import { LoanDocumentStatus as AppLoanDocumentStatus } from '@/types/loan';
import { type AppPermission } from '@/lib/permissions';
import { formatISO, isValid, isBefore } from 'date-fns';

/**
 * Helper to safely parse JSON strings or return the object if already parsed
 */
export function safeJsonParse<T>(value: any, defaultValue: T): T {
  if (typeof value === 'object' && value !== null) return value as T;
  try {
    return value ? JSON.parse(value) : defaultValue;
  } catch (error) {
    return defaultValue;
  }
}

export const mapPrismaUserToAppUser = (
  prismaUser: PrismaUser & {
    department?: PrismaDepartment | null;
    district?: { id: string; name: string } | null;
    customRole?: PrismaRole | null;
    crmMappings?: { branch: { name: string; districtId: string; branchId?: string; district: { name: string } } }[];
    committeeDecisions?: { id: string; decision: string; comment: string | null; member: { id: string; name: string } }[];
  }
): User => {
  const primaryDistrictFromMapping = prismaUser.crmMappings?.[0]?.branch;
  return {
    id: prismaUser.id,
    email: prismaUser.email,
    firstName: prismaUser.firstName || undefined,
    lastName: prismaUser.lastName || undefined,
    fullName: prismaUser.name || `${prismaUser.firstName || ''} ${prismaUser.lastName || ''}`.trim() || prismaUser.email,
    phoneNumber: prismaUser.phoneNumber || undefined,
    departmentId: prismaUser.departmentId || undefined,
    department: prismaUser.department?.name as Department | undefined,
    districtId: prismaUser.districtId || primaryDistrictFromMapping?.districtId || undefined,
    districtName: prismaUser.district?.name || primaryDistrictFromMapping?.district?.name || undefined,
    customRoleId: prismaUser.customRoleId || undefined,
    customRoleName: prismaUser.customRole?.name || undefined,
    permissions: safeJsonParse<AppPermission[]>(prismaUser.customRole?.permissions, []),
    assignedBranches: prismaUser.crmMappings?.map(m => m.branch.name) || [],
    isPasswordChanged: prismaUser.isPasswordChanged,
    isActive: prismaUser.isActive,
  };
};

export const mapPrismaLoanToAppLoan = (
    prismaLoan: PrismaLoanRequest & {
        customer: PrismaCustomer;
        sector: PrismaSector & { parent?: PrismaSector | null };
        requestType: PrismaRequestType;
        assignedToUsers: (PrismaUser & { department?: PrismaDepartment | null, customRole?: PrismaRole | null })[];
        stageCompletedBy: (PrismaUser & { department?: PrismaDepartment | null, customRole?: PrismaRole | null })[];
        currentWorkflowStage?: (PrismaWorkflowStageDefinition & { responsibleDepartment: PrismaDepartment, documentRequirements: PrismaDocumentRequirement[] }) | null;
        workflowVersion?: (PrismaWorkflowVersion & { 
          stages: PrismaWorkflowStageDefinition[],
          workflowDefinition: PrismaWorkflowDefinition & { sector: PrismaSector & { parent?: PrismaSector | null}, department: PrismaDepartment } 
        }) | null;
        assignedDepartment?: PrismaDepartment | null;
        assignedBy?: PrismaUser | null;
        createdBy?: PrismaUser | null;
        history?: (PrismaLoanHistoryEntry & { user?: (PrismaUser & { department?: PrismaDepartment | null, customRole?: PrismaRole | null }) | null })[];
        documents?: (PrismaLoanDocument & { requirement: PrismaDocumentRequirement | null })[];
        committeeDecisions?: { id: string; decision: string; comment: string | null; member: { id: string; name: string } }[];
    },
    options: { districtOverdueHours?: number } = {}
): LoanRequest => {

  const isTerminal = prismaLoan.isTerminalStage;
  let isOverdueCalc = false;
  if (prismaLoan.stageDeadline && isValid(new Date(prismaLoan.stageDeadline))) {
      isOverdueCalc = isBefore(new Date(prismaLoan.stageDeadline), new Date()) && !isTerminal;
  }

  // Custom rule for District (Type 2) submissions:
  // Use the configurable threshold (defaulting to 24 if not provided)
  if (!isOverdueCalc && prismaLoan.submissionType === 'TYPE2' && !prismaLoan.isReadyForValuation && !isTerminal) {
      const hoursThreshold = options.districtOverdueHours ?? 24;
      const thresholdAgo = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
      if (isBefore(new Date(prismaLoan.createdAt), thresholdAgo)) {
          isOverdueCalc = true;
      }
  }

  return {
    id: prismaLoan.id,
    loanNumber: prismaLoan.loanNumber,
    customerId: prismaLoan.customerId,
    customerName: prismaLoan.customer.name,
    customerEmail: prismaLoan.customer.email,
    customerPhone: prismaLoan.customer.phone || undefined,
    customerBranch: prismaLoan.customer.branch || undefined,
    loanAmount: Number(prismaLoan.loanAmount),
    sectorId: prismaLoan.sectorId,
    sectorName: prismaLoan.sector.name,
    parentSectorId: prismaLoan.sector.parentId || undefined,
    parentSectorName: prismaLoan.sector.parent?.name || undefined,
    requestTypeId: prismaLoan.requestTypeId,
    requestTypeName: prismaLoan.requestType.name,
    loanPurpose: prismaLoan.loanPurpose,

    workflowVersionId: prismaLoan.workflowVersionId || undefined,
    currentStageId: prismaLoan.currentStageId || undefined,
    currentStageStatus: prismaLoan.currentStageStatus || undefined,
    stageEntryDate: prismaLoan.stageEntryDate ? formatISO(new Date(prismaLoan.stageEntryDate)) : undefined,
    currentStageName: prismaLoan.currentWorkflowStage?.name || (prismaLoan.submissionType === 'TYPE2' ? 'LAF Preparation' : 'Unknown Stage'),
    currentStageOrder: prismaLoan.currentWorkflowStage?.order ?? (prismaLoan.submissionType === 'TYPE2' ? (prismaLoan.isValuationCompleted ? 4 : 2) : 0),
    assignedDepartmentId: prismaLoan.assignedDepartmentId || undefined,
    assignedDepartment: prismaLoan.assignedDepartment?.name as Department | undefined || 'N/A',

    assignedToUsers: prismaLoan.assignedToUsers.map(mapPrismaUserToAppUser),
    stageCompletedBy: prismaLoan.stageCompletedBy.map(mapPrismaUserToAppUser),
    
    assignedById: prismaLoan.assignedBy?.id || undefined,

    submittedDate: formatISO(new Date(prismaLoan.submittedDate)),
    lastUpdatedDate: formatISO(new Date(prismaLoan.lastUpdatedDate)),
    stageDeadline: prismaLoan.stageDeadline ? formatISO(new Date(prismaLoan.stageDeadline)) : undefined,
    isReadyForManagerReview: prismaLoan.isReadyForManagerReview,
    isUrgent: prismaLoan.isUrgent,
    isOverdue: isOverdueCalc,
    isTerminalStage: !!isTerminal,
    progressPercentage: (() => {
        if (isTerminal) return 100;
        
        // For standard workflow loans
        if (prismaLoan.workflowVersion?.stages && prismaLoan.currentWorkflowStage) {
            const currentOrder = prismaLoan.currentWorkflowStage.order;
            const completedWeight = prismaLoan.workflowVersion.stages
                .filter((s: PrismaWorkflowStageDefinition) => s.order < currentOrder)
                .reduce((sum: number, s: PrismaWorkflowStageDefinition) => sum + (s.percentageWeight || 0), 0);
            return Math.min(completedWeight, 99);
        }

        // For Type 2 (District) specific milestones if no workflow is attached yet
        if (prismaLoan.submissionType === 'TYPE2') {
            if (prismaLoan.isValuationCompleted) return 90;
            if (prismaLoan.isReadyForValuation) return 50;
            if (prismaLoan.lafStatus === 'COMPLETED') return 30;
            return 5;
        }

        return 0;
    })(),
    createdById: prismaLoan.createdById || undefined,
    createdBy: prismaLoan.createdBy ? mapPrismaUserToAppUser(prismaLoan.createdBy as any) : undefined,
    submissionType: prismaLoan.submissionType as any,
    lafStatus: prismaLoan.lafStatus as any,
    lafData: safeJsonParse(prismaLoan.lafData, undefined),
    pvrData: safeJsonParse(prismaLoan.pvrData, undefined),
    customerSummaryData: safeJsonParse(prismaLoan.customerSummaryData, undefined),
    valuationReportData: safeJsonParse(prismaLoan.valuationReportData, undefined),
    isReadyForValuation: prismaLoan.isReadyForValuation,
    isValuationCompleted: prismaLoan.isValuationCompleted,
    history: prismaLoan.history?.map((h) => ({
      id: h.id,
      userId: h.userId,
      userName: h.user?.name || (h.userId === 'system-prisma' ? 'System Process' : 'Unknown User'),
      userRole: h.user?.customRole?.name || undefined,
      userDepartment: h.user?.department?.name || undefined,
      userPhone: h.user?.phoneNumber || undefined,
      stageName: h.stageName,
      timestamp: formatISO(new Date(h.timestamp)),
      notes: h.notes || undefined,
      requiredFulfilment: h.requiredFulfilment || undefined,
      fulfillmentNotes: h.fulfillmentNotes || undefined,
      isFulfilled: h.isFulfilled,
      createdAt: h.createdAt ? formatISO(new Date(h.createdAt)) : undefined,
      updatedAt: h.updatedAt ? formatISO(new Date(h.updatedAt)) : undefined,
    })) || [],
    documents: prismaLoan.documents?.map((d) => ({
      id: d.id,
      name: d.name,
      requirementId: d.requirementId,
      status: d.status as AppLoanDocumentStatus,
      filePath: d.filePath || undefined,
      notes: d.notes || undefined,
      uploadedAt: d.uploadedAt ? formatISO(new Date(d.uploadedAt)) : undefined,
      createdAt: formatISO(new Date(d.createdAt)),
      updatedAt: formatISO(new Date(d.updatedAt)),
    })) || [],
    committeeDecisions: prismaLoan.committeeDecisions?.map((d: any) => ({
      id: d.id,
      decision: d.decision as 'APPROVE' | 'REJECT',
      comment: d.comment || undefined,
      member: {
        id: d.member.id,
        name: d.member.name,
      },
    })) || [],
    createdAt: formatISO(new Date(prismaLoan.createdAt)),
    updatedAt: formatISO(new Date(prismaLoan.updatedAt)),
  };
};
