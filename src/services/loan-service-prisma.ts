
'use server';
import prisma from '@/lib/prisma';
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

import { LoanDocumentStatus as PrismaLoanDocumentStatus, DocumentRequirementType as PrismaDocumentRequirementType } from '@prisma/client';

import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, LoanDocument, LoanHistoryEntry, ActiveWorkflow, DocumentRequirement, Customer, CustomerWithDepartment, Sector, RequestType } from '@/types/loan';
import { LoanDocumentStatus as AppLoanDocumentStatus, DocumentRequirementType as AppDocumentRequirementType } from '@/types/loan';
import { PERMISSIONS, type AppPermission } from '@/lib/permissions';
import { getCurrentUser } from '@/app/auth/actions';

import { formatISO, parseISO, addDays, isBefore, isValid } from 'date-fns';

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  const genericMessage = 'An unexpected error occurred. Please try again later.';
  console.error(`[PrismaService:${context || 'Unknown'}] Error: ${message}`, originalError);
  return { error: message }; // Return specific error to client for admin-facing functions
};

const mapPrismaUserToAppUser = (
  prismaUser: PrismaUser & {
    department?: PrismaDepartment | null;
    customRole?: PrismaRole | null;
  }
): User => {
  return {
    id: prismaUser.id,
    email: prismaUser.email,
    firstName: prismaUser.firstName || undefined,
    lastName: prismaUser.lastName || undefined,
    fullName: prismaUser.name || `${prismaUser.firstName || ''} ${prismaUser.lastName || ''}`.trim() || prismaUser.email,
    phoneNumber: prismaUser.phoneNumber || undefined,
    departmentId: prismaUser.departmentId || undefined,
    department: prismaUser.department?.name as Department | undefined,
    customRoleId: prismaUser.customRoleId || undefined,
    customRoleName: prismaUser.customRole?.name || undefined,
    permissions: (prismaUser.customRole?.permissions as AppPermission[]) || [],
    isPasswordChanged: prismaUser.isPasswordChanged,
    isActive: prismaUser.isActive,
  };
};

const mapPrismaLoanToAppLoan = (
    prismaLoan: PrismaLoanRequest & {
        customer: PrismaCustomer;
        sector: PrismaSector & { parent?: PrismaSector | null };
        requestType: PrismaRequestType;
        assignedToUsers: (PrismaUser & { department?: PrismaDepartment | null, customRole?: PrismaRole | null })[];
        stageCompletedBy: (PrismaUser & { department?: PrismaDepartment | null, customRole?: PrismaRole | null })[];
        currentWorkflowStage?: (PrismaWorkflowStageDefinition & { responsibleDepartment: PrismaDepartment, documentRequirements: PrismaDocumentRequirement[] }) | null;
        workflowVersion?: (PrismaWorkflowVersion & { workflowDefinition: PrismaWorkflowDefinition & { sector: PrismaSector & { parent?: PrismaSector | null}, department: PrismaDepartment } }) | null;
        assignedDepartment?: PrismaDepartment | null;
        history?: (PrismaLoanHistoryEntry & { user?: (PrismaUser & { customRole?: PrismaRole | null }) | null })[];
        documents?: (PrismaLoanDocument & { requirement: PrismaDocumentRequirement | null })[];
    }
): LoanRequest => {

  const isTerminal = prismaLoan.isTerminalStage;
  let isOverdueCalc = false;
  if (prismaLoan.stageDeadline && isValid(new Date(prismaLoan.stageDeadline))) {
      isOverdueCalc = isBefore(new Date(prismaLoan.stageDeadline), new Date()) && !isTerminal;
  }

  return {
    id: prismaLoan.id,
    loanNumber: prismaLoan.loanNumber,
    customerId: prismaLoan.customerId,
    customerName: prismaLoan.customer.name,
    customerEmail: prismaLoan.customer.email,
    customerPhone: prismaLoan.customer.phone || undefined,
    customerBranch: prismaLoan.customer.branch || undefined,
    loanAmount: prismaLoan.loanAmount.toNumber(),
    sectorId: prismaLoan.sectorId,
    sectorName: prismaLoan.sector.name,
    parentSectorId: prismaLoan.sector.parentId || undefined,
    parentSectorName: prismaLoan.sector.parent?.name || undefined,
    requestTypeId: prismaLoan.requestTypeId,
    requestTypeName: prismaLoan.requestType.name,
    loanPurpose: prismaLoan.loanPurpose,

    workflowVersionId: prismaLoan.workflowVersionIdMirror || undefined,
    currentStageId: prismaLoan.currentStageIdMirror || undefined,
    currentStageStatus: prismaLoan.currentStageStatus || undefined,
    stageEntryDate: prismaLoan.stageEntryDate ? formatISO(new Date(prismaLoan.stageEntryDate)) : undefined,
    currentStageName: prismaLoan.currentWorkflowStage?.name || 'Unknown Stage',
    assignedDepartmentId: prismaLoan.assignedDepartmentId || undefined,
    assignedDepartment: prismaLoan.assignedDepartment?.name as Department | undefined || 'N/A',

    assignedToUsers: prismaLoan.assignedToUsers.map(mapPrismaUserToAppUser),
    stageCompletedBy: prismaLoan.stageCompletedBy.map(mapPrismaUserToAppUser),
    submittedDate: formatISO(new Date(prismaLoan.submittedDate)),
    lastUpdatedDate: formatISO(new Date(prismaLoan.lastUpdatedDate)),
    stageDeadline: prismaLoan.stageDeadline ? formatISO(new Date(prismaLoan.stageDeadline)) : undefined,
    isReadyForManagerReview: prismaLoan.isReadyForManagerReview,
    isUrgent: prismaLoan.isUrgent,
    isOverdue: isOverdueCalc,
    isTerminalStage: !!isTerminal,
    createdById: prismaLoan.createdById || undefined,
    history: prismaLoan.history?.map((h) => ({
      id: h.id,
      userId: h.userId,
      userName: h.user?.name || (h.userId === 'system-prisma' ? 'System Process' : 'Unknown User'),
      stageName: h.stageName,
      timestamp: formatISO(new Date(h.timestamp)),
      notes: h.notes || undefined,
      requiredFulfilment: h.requiredFulfilment || undefined,
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
    createdAt: formatISO(new Date(prismaLoan.createdAt)),
    updatedAt: formatISO(new Date(prismaLoan.updatedAt)),
  };
};


export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerId' | 'stageDeadline' | 'assignedToUsers' | 'isReadyForManagerReview' | 'currentStageId' | 'assignedDepartmentId' | 'assignedDepartment' | 'currentStageName' | 'isTerminalStage' | 'createdAt' | 'updatedAt' | 'currentStageStatus' | 'isUrgent' | 'stageEntryDate' | 'stageCompletedBy' | 'sectorName' | 'requestTypeName' | 'parentSectorId' | 'parentSectorName' | 'isActive'>
  & { sectorId: string; requestTypeId: string; }
): Promise<{ id?: string; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.CREATE_LOAN_REQUEST)) {
        return createErrorResult("Unauthorized: You do not have permission to create loan requests.", "addLoanRequest");
    }

    const selectedChildSector = await prisma.sector.findUnique({
        where: { id: loanData.sectorId },
        include: { parent: true }
    });
    if (!selectedChildSector || !selectedChildSector.parentId) {
        return createErrorResult("Invalid child sector selected or it has no parent.", "addLoanRequest");
    }

    const firstWorkflowInSequence = await prisma.workflowDefinition.findFirst({
      where: {
        sector: {
            parentId: selectedChildSector.parentId
        }
      },
      orderBy: { order: 'asc' },
    });
    
    if (!firstWorkflowInSequence) {
        return createErrorResult(`No workflow sequence found for the selected Child Sector.`, "addLoanRequest");
    }

    const activeVersion = await prisma.workflowVersion.findFirst({
        where: {
            workflowDefinitionId: firstWorkflowInSequence.id,
            isActive: true,
        },
        include: {
            workflowDefinition: {
                include: { sector: { include: { parent: true }}, department: true },
            },
            stages: {
                orderBy: { order: 'asc' },
                include: { responsibleDepartment: true }
            },
        },
    });

    if (!activeVersion || !activeVersion.workflowDefinition.department || activeVersion.stages.length === 0) {
        return createErrorResult(`The first workflow in the sequence ("${firstWorkflowInSequence.name}") has no active version or is improperly configured.`, "addLoanRequest");
    }

    const firstStage = activeVersion.stages[0];
    const initialDepartment = activeVersion.workflowDefinition.department;

    if (typeof firstStage.defaultTimelineDays !== 'number' || isNaN(firstStage.defaultTimelineDays) || firstStage.defaultTimelineDays < 0) {
      return createErrorResult(`Invalid timeline configuration for the first stage.`, "addLoanRequest");
    }
    const currentDate = new Date();
    const stageDeadlineDate = addDays(currentDate, firstStage.defaultTimelineDays);

    const systemUserId = 'system-prisma';
    const initialHistoryNote = `Loan application submitted by ${user.fullName}. Initial Department: ${initialDepartment.name}. Workflow: ${activeVersion.workflowDefinition.name} (V${activeVersion.versionNumber}). Initial stage: ${firstStage.name}. Awaiting assignment.`;
    
    const availableStatusesForDept = firstStage.availableStatuses && typeof firstStage.availableStatuses === 'object' && !Array.isArray(firstStage.availableStatuses) ? (firstStage.availableStatuses as Record<string, string[]>)[firstStage.responsibleDepartment.name] : [];
    const initialStatus = availableStatusesForDept && availableStatusesForDept.length > 0 ? availableStatusesForDept[0] : 'Initiated';

    const customer = await prisma.customer.upsert({
      where: { email: loanData.customerEmail },
      update: {
        name: loanData.customerName,
        phone: loanData.customerPhone || null,
        branch: loanData.customerBranch || null,
      },
      create: {
        email: loanData.customerEmail,
        name: loanData.customerName,
        phone: loanData.customerPhone || null,
        branch: loanData.customerBranch || null,
      },
    });

    const newLoan = await prisma.loanRequest.create({
      data: {
        loanNumber: `LN-PSQL-${String(Date.now()).slice(-6)}`,
        customer: { connect: { id: customer.id } },
        loanAmount: loanData.loanAmount,
        sector: { connect: { id: loanData.sectorId } },
        requestType: { connect: { id: loanData.requestTypeId } },
        loanPurpose: loanData.loanPurpose,
        submittedDate: currentDate,
        lastUpdatedDate: currentDate,
        stageEntryDate: currentDate,
        stageDeadline: stageDeadlineDate,
        workflowVersion: { connect: { id: activeVersion.id } },
        currentWorkflowStage: { connect: { id: firstStage.id } },
        assignedDepartment: { connect: { id: initialDepartment.id } },
        currentStageStatus: initialStatus,
        createdById: user.id, // Store who submitted the loan
      },
    });
    
    await prisma.loanHistoryEntry.create({
      data: {
        loanRequest: { connect: { id: newLoan.id } },
        user: { connect: { id: systemUserId } },
        stageName: firstStage.name,
        timestamp: currentDate,
        notes: initialHistoryNote,
      }
    });

    return { id: newLoan.id };
  } catch (e: any) {
    return createErrorResult(`Failed to add loan request. ${e.message}`, "addLoanRequest", e);
  }
}

export async function getLoanRequests(): Promise<{ loans?: LoanRequest[], error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized: No user session found." };
    }
    
    const userPermissions = new Set(user.permissions || []);
    let whereClause: any = {};

    const isFullAdmin = userPermissions.has(PERMISSIONS.MANAGE_USERS);
    const isManager = userPermissions.has(PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE);

    if (isFullAdmin) {
      // Admins can see all loans. No filter needed.
    } else if (isManager) {
        // Managers see all loans in their department.
        if (user.departmentId) {
            whereClause = { assignedDepartmentId: user.departmentId };
        } else {
            // Manager without a department can only see loans directly assigned to them.
            whereClause = { assignedToUsers: { some: { id: user.id } } };
        }
    } else {
        // Non-managers see loans assigned to them OR unassigned loans in their department.
        if (user.departmentId) {
            whereClause = {
                OR: [
                    { assignedToUsers: { some: { id: user.id } } }, // Assigned to them
                    { 
                        assignedDepartmentId: user.departmentId, // In their department
                        assignedToUsers: { none: {} } // And unassigned
                    },
                ]
            };
        } else {
            // If they have no department, they can only see what's directly assigned.
            whereClause = { assignedToUsers: { some: { id: user.id } } };
        }
    }


    const prismaLoans = await prisma.loanRequest.findMany({
      where: whereClause,
      orderBy: [{ isUrgent: 'desc' }, { lastUpdatedDate: 'desc' }],
      include: {
        customer: true,
        sector: { include: { parent: true } },
        requestType: true,
        assignedToUsers: { include: { department: true, customRole: true } },
        stageCompletedBy: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
        workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
        assignedDepartment: true,
        history: { include: { user: { include: { customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    const appLoans = prismaLoans.map(pl => mapPrismaLoanToAppLoan(pl as any));
    
    return { loans: appLoans };
  } catch (e: any) {
    return createErrorResult("Failed to fetch loan requests.", "getLoanRequests", e);
  }
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string; workflowDefinitions?: WorkflowDefinition[] }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_LOAN_DETAILS)) {
        return { error: "Unauthorized: You do not have permission to view loan details." };
    }

    const prismaLoan = await prisma.loanRequest.findUnique({
      where: { id },
      include: {
        customer: true,
        sector: { include: { parent: true } },
        requestType: true,
        assignedToUsers: { include: { department: true, customRole: true } },
        stageCompletedBy: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
        workflowVersion: {
          include: {
            workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } },
            stages: { orderBy: { order: 'asc' }, include: {responsibleDepartment: true, documentRequirements: true} },
          },
        },
        assignedDepartment: true,
        history: { include: { user: { include: { customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    if (!prismaLoan) {
      return { loan: null, users: [], error: `Loan with ID "${id}" not found.` };
    }

    const appLoan = mapPrismaLoanToAppLoan(prismaLoan as any);
    const prismaUsers = await prisma.user.findMany({ include: { department: true, customRole: true } });
    const appUsers = prismaUsers.map(mapPrismaUserToAppUser);

    const wfDefsResult = await getWorkflowDefinitions();

    return { loan: appLoan, users: appUsers, workflowDefinitions: wfDefsResult.workflows };
  } catch (e: any) {
    return createErrorResult(`Failed to fetch loan request.`, "getLoanRequestById", e);
  }
}


export async function updateLoanRequest(
  id: string,
  dataToUpdate: Partial<Omit<LoanRequest, 'id'>>
): Promise<{ success?: boolean; updatedLoan?: LoanRequest; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) {
        return createErrorResult("Unauthorized: No user session found.", "updateLoanRequest");
    }
    const userPermissions = new Set(user.permissions || []);

    const existingLoan = await prisma.loanRequest.findUnique({ where: { id }, include: { history: true, documents: true } });
    if (!existingLoan) {
      throw new Error(`Loan with ID "${id}" not found.`);
    }
    
    let primaryAction: AppPermission | null = null;
    let requiredPermissions: AppPermission[] = [];
    
    const isStageChanging = dataToUpdate.currentStageId && dataToUpdate.currentStageId !== existingLoan.currentStageIdMirror;
    const isTerminating = dataToUpdate.isTerminalStage === true && existingLoan.isTerminalStage === false;
    let newHistoryEntries: LoanHistoryEntry[] = [];
    if (dataToUpdate.history) {
        const existingHistoryIds = new Set((existingLoan.history || []).map(h => h.id));
        newHistoryEntries = (dataToUpdate.history || []).filter(h => !existingHistoryIds.has(h.id));
    }

    // Determine the primary action and its required permissions
    if (isStageChanging && (newHistoryEntries[0]?.notes || '').includes('MANUAL TRANSITION')) {
        primaryAction = PERMISSIONS.MANUAL_STAGE_TRANSITION;
        requiredPermissions.push(primaryAction);
    } else if (isStageChanging) {
        primaryAction = PERMISSIONS.PROMOTE_LOAN_STAGE;
        requiredPermissions.push(primaryAction);
    } else if (isTerminating) {
        primaryAction = PERMISSIONS.TERMINATE_LOAN_PROCESS;
        requiredPermissions.push(primaryAction);
    } else if (dataToUpdate.hasOwnProperty('assignedToUsers')) {
        primaryAction = PERMISSIONS.ASSIGN_LOAN_TO_STAFF;
        requiredPermissions.push(primaryAction);
    } else if (dataToUpdate.hasOwnProperty('stageCompletedBy')) {
        primaryAction = PERMISSIONS.MARK_STAGE_COMPLETE;
        requiredPermissions.push(primaryAction);
    } else if (dataToUpdate.hasOwnProperty('documents')) {
        primaryAction = PERMISSIONS.UPLOAD_LOAN_DOCUMENTS; // Could also be VERIFY or CHECKBOX, this is a safe default
        requiredPermissions.push(PERMISSIONS.UPLOAD_LOAN_DOCUMENTS, PERMISSIONS.VERIFY_LOAN_DOCUMENTS, PERMISSIONS.EDIT_LOAN_DETAILS);
    } else if (newHistoryEntries.length > 0) {
        const newNoteText = newHistoryEntries[0].notes || '';
        if (newNoteText.includes('rework')) { primaryAction = PERMISSIONS.RETURN_LOAN_FOR_REWORK; requiredPermissions.push(primaryAction); }
        else if (newNoteText.includes('information request')) { primaryAction = PERMISSIONS.LOG_INFO_REQUEST; requiredPermissions.push(primaryAction); }
        else { primaryAction = PERMISSIONS.ADD_LOAN_NOTES; requiredPermissions.push(primaryAction); }
    } else { // Fallback for simple flags like 'isUrgent' or fulfilling info requests
        const hasModifiedEntries = (dataToUpdate.history || []).some(h => {
            const oldEntry = (existingLoan.history || []).find(eh => eh.id === h.id);
            return oldEntry && oldEntry.notes !== h.notes;
        });
        if (hasModifiedEntries) {
            primaryAction = PERMISSIONS.FULFILL_INFO_REQUEST;
            requiredPermissions.push(primaryAction);
        } else {
             primaryAction = PERMISSIONS.EDIT_LOAN_DETAILS;
             requiredPermissions.push(primaryAction);
        }
    }
    
    // Authorization Check
    const hasSufficientPermission = requiredPermissions.some(p => userPermissions.has(p));

    if (!hasSufficientPermission && primaryAction) {
      throw new Error(`Unauthorized action: You need the '${primaryAction}' permission.`);
    }


    const updatedPrismaLoan = await prisma.$transaction(async (tx) => {
      const updatePayload: any = { lastUpdatedDate: new Date() };
      
      const simpleFields: (keyof Pick<LoanRequest, 'loanPurpose' | 'isReadyForManagerReview' | 'currentStageStatus' | 'isTerminalStage' | 'isUrgent'>)[] = ['loanPurpose', 'isReadyForManagerReview', 'currentStageStatus', 'isTerminalStage', 'isUrgent'];
      simpleFields.forEach(field => {
        if (dataToUpdate[field] !== undefined) updatePayload[field] = dataToUpdate[field];
      });

      if (dataToUpdate.loanAmount !== undefined) {
        if (!userPermissions.has(PERMISSIONS.EDIT_LOAN_DETAILS)) throw new Error("Unauthorized to edit loan amount.");
        updatePayload.loanAmount = dataToUpdate.loanAmount;
      }
      
      if (dataToUpdate.hasOwnProperty('assignedToUsers')) {
        const userIds = dataToUpdate.assignedToUsers?.map(u => ({ id: u.id })) || [];
        updatePayload.assignedToUsers = { set: userIds };
        // Reset completion only if assignment is the primary action
        if (primaryAction === PERMISSIONS.ASSIGN_LOAN_TO_STAFF) {
          updatePayload.stageCompletedBy = { set: [] };
          updatePayload.isReadyForManagerReview = false;
        }
      }

      if (dataToUpdate.hasOwnProperty('stageCompletedBy')) {
          const userIds = dataToUpdate.stageCompletedBy?.map(u => ({ id: u.id })) || [];
          updatePayload.stageCompletedBy = { set: userIds };
      }

      if (dataToUpdate.currentStageId && dataToUpdate.currentStageId !== existingLoan.currentStageIdMirror) {
        const wfVerId = dataToUpdate.workflowVersionId || existingLoan.workflowVersionIdMirror;
        if (!wfVerId) throw new Error("Workflow version context missing.");

        const newStageDef = await tx.workflowStageDefinition.findUnique({
          where: { id: dataToUpdate.currentStageId },
          include: { responsibleDepartment: true }
        });
        if (!newStageDef) throw new Error(`Stage definition not found.`);
        
        updatePayload.currentWorkflowStage = { connect: { id: newStageDef.id } };
        updatePayload.workflowVersion = { connect: { id: wfVerId } }; 
        updatePayload.stageEntryDate = new Date();
        const newStageDeadline = addDays(new Date(), newStageDef.defaultTimelineDays);
        updatePayload.stageDeadline = newStageDeadline;
        
        updatePayload.isReadyForManagerReview = false;
        updatePayload.stageCompletedBy = { set: [] };
        updatePayload.assignedToUsers = { set: [] };
        updatePayload.assignedDepartment = { connect: { id: newStageDef.responsibleDepartmentId } };
        
        const availableStatusesForDept = newStageDef.availableStatuses && typeof newStageDef.availableStatuses === 'object' && !Array.isArray(newStageDef.availableStatuses) ? (newStageDef.availableStatuses as Record<string, string[]>)[newStageDef.responsibleDepartment.name] : [];
        updatePayload.currentStageStatus = availableStatusesForDept && availableStatusesForDept.length > 0 ? availableStatusesForDept[0] : 'Initiated';

        updatePayload.isTerminalStage = newStageDef.name.toLowerCase().includes("closed") || newStageDef.name.toLowerCase().includes("rejected") || newStageDef.name.toLowerCase().includes("funded") || dataToUpdate.isTerminalStage === true;
      }

      if (dataToUpdate.hasOwnProperty('history')) {
        const existingHistoryIds = new Set((existingLoan.history || []).map(h => h.id));
        const newHistoryEntries = (dataToUpdate.history || []).filter(h => !existingHistoryIds.has(h.id));
        const modifiedEntries = (dataToUpdate.history || []).filter(h => {
            const oldEntry = (existingLoan.history || []).find(eh => eh.id === h.id);
            return oldEntry && oldEntry.notes !== h.notes;
        });

        if (newHistoryEntries.length > 0) {
            for (const entry of newHistoryEntries) {
                await tx.loanHistoryEntry.create({
                    data: {
                        loanRequest: { connect: { id } },
                        user: { connect: { id: entry.userId } },
                        stageName: entry.stageName,
                        timestamp: parseISO(entry.timestamp),
                        notes: entry.notes,
                        requiredFulfilment: entry.requiredFulfilment,
                    }
                });
            }
        }
        if (modifiedEntries.length > 0) {
            for (const entry of modifiedEntries) {
                await tx.loanHistoryEntry.update({ where: { id: entry.id }, data: { notes: entry.notes } });
            }
        }
      }

      if (dataToUpdate.documents !== undefined) {
        const currentDocIds = new Set(existingLoan.documents.map(d => d.id));
        const updatedDocIds = new Set(dataToUpdate.documents.map(d => d.id));

        const docsToAdd = dataToUpdate.documents.filter(d => !currentDocIds.has(d.id));
        const docsToDelete = existingLoan.documents.filter(d => !updatedDocIds.has(d.id));
        const docsToUpdate = dataToUpdate.documents.filter(d => currentDocIds.has(d.id));

        if (docsToDelete.length > 0) {
            await tx.loanDocument.deleteMany({
                where: { id: { in: docsToDelete.map(d => d.id) } },
            });
        }
        if (docsToAdd.length > 0) {
            for (const doc of docsToAdd) {
                await tx.loanDocument.create({
                    data: {
                        loanRequest: { connect: { id } },
                        requirement: doc.requirementId ? { connect: { id: doc.requirementId } } : undefined,
                        name: doc.name,
                        status: doc.status as PrismaLoanDocumentStatus,
                        filePath: doc.filePath,
                        notes: doc.notes,
                        uploadedAt: doc.uploadedAt ? parseISO(doc.uploadedAt) : undefined,
                    },
                });
            }
        }
        if (docsToUpdate.length > 0) {
            for (const doc of docsToUpdate) {
                await tx.loanDocument.update({
                    where: { id: doc.id },
                    data: {
                        status: doc.status as PrismaLoanDocumentStatus,
                        notes: doc.notes,
                        filePath: doc.filePath,
                    },
                });
            }
        }
      }

      return tx.loanRequest.update({
        where: { id },
        data: updatePayload,
        include: {
          customer: true,
          sector: { include: { parent: true } },
          requestType: true,
          assignedToUsers: { include: { department: true, customRole: true } },
          stageCompletedBy: { include: { department: true, customRole: true } },
          currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
          workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
          assignedDepartment: true,
          history: { include: { user: { include: { customRole: true } } }, orderBy: { timestamp: 'desc' } },
          documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
        },
      });
    });
    const appLoan = mapPrismaLoanToAppLoan(updatedPrismaLoan as any);
    return { success: true, updatedLoan: appLoan };

  } catch (e: any) {
    return createErrorResult(`Failed to update loan request: ${e.message}`, "updateLoanRequest", e);
  }
}


export async function getWorkflowDefinitions(): Promise<{ workflows?: WorkflowDefinition[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_LOAN_DETAILS)) {
        return { error: "Unauthorized: You do not have permission to view workflow definitions." };
    }
    const prismaWorkflowDefs = await prisma.workflowDefinition.findMany({
      orderBy: { order: 'asc' },
      include: {
        sector: { include: { parent: true } },
        department: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            stages: {
              orderBy: { order: 'asc' },
              include: { responsibleDepartment: true, documentRequirements: true }
            },
          },
        },
      },
    });

    const appWorkflowDefs: WorkflowDefinition[] = prismaWorkflowDefs.map(def => ({
      id: def.id,
      name: def.name,
      sectorId: def.sectorId,
      sectorName: def.sector.name,
      parentSectorId: def.sector.parentId ?? undefined,
      parentSectorName: def.sector.parent?.name,
      departmentId: def.departmentId,
      departmentName: def.department.name,
      description: def.description || undefined,
      order: def.order,
      createdAt: formatISO(new Date(def.createdAt)),
      updatedAt: formatISO(new Date(def.updatedAt)),
      versions: def.versions.map(v => ({
        id: v.id,
        workflowDefinitionId: v.workflowDefinitionId,
        versionNumber: v.versionNumber,
        isActive: v.isActive,
        createdAt: formatISO(new Date(v.createdAt)),
        updatedAt: v.updatedAt ? formatISO(new Date(v.updatedAt)) : undefined,
        stages: v.stages.map(s => ({
          id: s.id,
          name: s.name,
          responsibleDepartment: s.responsibleDepartment.name as Department,
          defaultTimelineDays: s.defaultTimelineDays,
          documentRequirements: s.documentRequirements.map(dr => ({
             id: dr.id,
             name: dr.name,
             isMandatory: dr.isMandatory,
             type: dr.type as AppDocumentRequirementType,
          })),
          percentageWeight: s.percentageWeight,
          order: s.order,
          availableStatuses: (s.availableStatuses || {}) as Record<Department, string[]>,
          createdAt: s.createdAt ? formatISO(new Date(s.createdAt)) : undefined,
          updatedAt: s.updatedAt ? formatISO(new Date(s.updatedAt)) : undefined,
        })),
      })),
    }));

    return { workflows: appWorkflowDefs };
  } catch (e: any) {
    return createErrorResult("Failed to fetch workflow definitions.", "getWorkflowDefinitions", e);
  }
}

export async function addWorkflowDefinition(
  definitionData: Omit<WorkflowDefinition, 'id' | 'versions' | 'createdAt' | 'updatedAt' | 'sectorName' | 'parentSectorName' | 'departmentName' | 'order'>
): Promise<{ id?: string; error?: string }> {
  try {
     const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS)) {
        return createErrorResult("Unauthorized", "addWorkflowDefinition");
    }
    const existing = await prisma.workflowDefinition.findFirst({
        where: {
            departmentId: definitionData.departmentId,
            sectorId: definitionData.sectorId,
        },
    });
    if (existing) {
        return createErrorResult(`A workflow definition for this department and child sector combination already exists.`, "addWorkflowDefinition");
    }

    const maxOrder = await prisma.workflowDefinition.aggregate({ _max: { order: true }});
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const newDef = await prisma.workflowDefinition.create({
      data: {
        name: definitionData.name,
        department: { connect: { id: definitionData.departmentId } },
        sector: { connect: { id: definitionData.sectorId } },
        description: definitionData.description,
        order: nextOrder,
      },
    });
    return { id: newDef.id };
  } catch (e: any) {
    if ((e as any).code === 'P2003' && (e as any).meta?.field_name?.includes('parentId')) {
        return createErrorResult("Invalid Parent Sector selected.", "addWorkflowDefinition", e);
    }
    return createErrorResult("Failed to add workflow definition.", "addWorkflowDefinition", e);
  }
}

export async function saveWorkflowDefinitions(definitions: WorkflowDefinition[]): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS)) {
        return createErrorResult("Unauthorized", "saveWorkflowDefinitions");
    }
    await prisma.$transaction(async (tx) => {
      for (const definition of definitions) {
        const { versions, ...defData } = definition;

        const upsertedDef = await tx.workflowDefinition.upsert({
          where: { id: definition.id || `_non_existent_def_id_${Date.now()}` },
          create: {
            id: definition.id || undefined,
            name: defData.name,
            description: defData.description,
            order: defData.order,
            department: { connect: { id: defData.departmentId } },
            sector: { connect: { id: defData.sectorId } },
          },
          update: {
            name: defData.name,
            description: defData.description,
            order: defData.order,
            department: { connect: { id: defData.departmentId } },
            sector: { connect: { id: defData.sectorId } },
            updatedAt: new Date(),
          },
        });
        const definitionId = upsertedDef.id;

        const existingDbVersionIds = (await tx.workflowVersion.findMany({ where: { workflowDefinitionId: definitionId }, select: { id: true }})).map(v => v.id);
        const uiVersionIds = new Set(versions.map(v => v.id).filter(Boolean));
        const versionsToDelete = existingDbVersionIds.filter(id => !uiVersionIds.has(id));
        if (versionsToDelete.length > 0) {
            await tx.documentRequirement.deleteMany({ where: { workflowStageId: { in: versionsToDelete } } });
            await tx.workflowStageDefinition.deleteMany({ where: { workflowVersion: { id: { in: versionsToDelete } } } });
            await tx.workflowVersion.deleteMany({ where: { id: { in: versionsToDelete }}});
        }

        for (const version of versions) {
          const { stages, ...versionData } = version;
          const createPayload: any = {
              ...versionData,
              id: version.id || undefined,
              workflowDefinition: { connect: { id: definitionId } },
          };
          delete createPayload.workflowDefinitionId; 

          const updatePayload: any = {
              ...versionData,
              id: undefined,
              updatedAt: new Date(),
          };
          delete updatePayload.workflowDefinitionId;


          const upsertedVersion = await tx.workflowVersion.upsert({
            where: { id: version.id || `_non_existent_ver_id_${Date.now()}` },
            create: createPayload,
            update: updatePayload,
          });
          const versionId = upsertedVersion.id;

          const existingDbStageIds = (await tx.workflowStageDefinition.findMany({ where: { workflowVersionId: versionId }, select: { id: true }})).map(s => s.id);
          const uiStageIds = new Set(stages.map(s => s.id).filter(Boolean));
          const stagesToDelete = existingDbStageIds.filter(id => !uiStageIds.has(id));
          if (stagesToDelete.length > 0) {
            await tx.documentRequirement.deleteMany({ where: { workflowStageId: { in: stagesToDelete } } });
            await tx.workflowStageDefinition.deleteMany({ where: { id: { in: stagesToDelete }}});
          }

          for (const stage of stages) {
             const department = await tx.department.findUnique({ where: {nameLowercase: stage.responsibleDepartment.toLowerCase() }});
             if (!department) throw new Error(`Department "${stage.responsibleDepartment}" not found.`);

            const { documentRequirements, ...stageData } = stage;

            const upsertedStage = await tx.workflowStageDefinition.upsert({
              where: { id: stage.id || `_non_existent_stage_id_${Date.now()}` },
              create: {
                ...stageData,
                id: stage.id || undefined,
                availableStatuses: stage.availableStatuses || {},
                workflowVersion: { connect: { id: versionId } },
                responsibleDepartment: { connect: { id: department.id } },
              },
              update: {
                ...stageData,
                id: undefined,
                availableStatuses: stage.availableStatuses || {},
                updatedAt: new Date(),
                responsibleDepartment: { connect: { id: department.id } },
              },
            });

            const existingReqs = await tx.documentRequirement.findMany({ where: { workflowStageId: upsertedStage.id }});
            const uiReqIds = new Set(documentRequirements.map(dr => dr.id));
            const reqsToDelete = existingReqs.filter(er => !uiReqIds.has(er.id));
            if (reqsToDelete.length > 0) {
                await tx.documentRequirement.deleteMany({ where: { id: { in: reqsToDelete.map(r => r.id) } } });
            }

            for (const req of documentRequirements) {
                await tx.documentRequirement.upsert({
                    where: { id: req.id || `_non_existent_req_id_${Date.now()}` },
                    create: {
                        id: req.id || undefined,
                        name: req.name,
                        isMandatory: req.isMandatory,
                        type: req.type as PrismaDocumentRequirementType,
                        workflowStage: { connect: { id: upsertedStage.id } }
                    },
                    update: {
                        name: req.name,
                        isMandatory: req.isMandatory,
                        type: req.type as PrismaDocumentRequirementType,
                    }
                });
            }
          }
        }
      }
    });
    return { success: true };
  } catch (e: any) {
    return createErrorResult("Failed to save workflow definitions.", "saveWorkflowDefinitions", e);
  }
}

export async function getDepartments(): Promise<{ departments?: {id: string, name: Department}[]; error?: string }> {
  try {
     const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS)) {
        return { error: "Unauthorized" };
    }
    const prismaDepartments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
    });
    const appDepartments = prismaDepartments.map(d => ({ id: d.id, name: d.name as Department }));
    return { departments: appDepartments };
  } catch (e: any) {
    return createErrorResult("Failed to fetch departments.", "getDepartments", e);
  }
}

export async function addDepartment(departmentName: string): Promise<{ id?: string; error?: string }> {
  try {
     const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS)) {
        return createErrorResult("Unauthorized", "addDepartment");
    }
    const nameLower = departmentName.trim().toLowerCase();
    const existing = await prisma.department.findUnique({ where: { nameLowercase: nameLower } });
    if (existing) {
      return createErrorResult(`Department "${departmentName.trim()}" already exists.`, "addDepartment");
    }

    const newDepartment = await prisma.department.create({
      data: {
        name: departmentName.trim(),
        nameLowercase: nameLower,
      },
    });
    return { id: newDepartment.id };
  } catch (e: any) {
    return createErrorResult("Failed to add department.", "addDepartment", e);
  }
}

export async function deleteDepartment(departmentId: string): Promise<{ success?: boolean; error?: string }> {
  try {
     const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS)) {
        return createErrorResult("Unauthorized", "deleteDepartment");
    }
    const stagesUsingDept = await prisma.workflowStageDefinition.count({ where: { responsibleDepartmentId: departmentId } });
    if (stagesUsingDept > 0) {
        return createErrorResult(`Cannot delete: Department is in use by workflow stages.`, "deleteDepartment_inUseStages");
    }
     const usersInDept = await prisma.user.count({ where: { departmentId: departmentId } });
     if (usersInDept > 0) {
        return createErrorResult(`Cannot delete: Department is assigned to users.`, "deleteDepartment_inUseUsers");
    }

    await prisma.department.delete({ where: { id: departmentId } });
    return { success: true };
  } catch (e: any) {
    return createErrorResult(`Failed to delete department.`, "deleteDepartment", e);
  }
}

export async function getActiveWorkflowsForCreate(): Promise<{ activeWorkflows?: ActiveWorkflow[]; error?: string }> {
  try {
    const activeVersions = await prisma.workflowVersion.findMany({
      where: {
        isActive: true,
        stages: {
          some: {} 
        }
      },
      include: {
        workflowDefinition: {
          include: {
            sector: { include: { parent: true }},
            department: true,
          }
        }
      },
      orderBy: [
        { workflowDefinition: { sector: { name: 'asc' }}},
        { workflowDefinition: { name: 'asc' }}
      ]
    });

    const mappedWorkflows: ActiveWorkflow[] = activeVersions.map(v => ({
      id: v.id,
      name: `${v.workflowDefinition.name} (v${v.versionNumber})`,
      sectorName: v.workflowDefinition.sector.name,
      departmentName: v.workflowDefinition.department.name,
    }));

    return { activeWorkflows: mappedWorkflows };
  } catch (e: any) {
    return createErrorResult("Failed to fetch active workflows.", "getActiveWorkflowsForCreate", e);
  }
}

export async function getCustomers(): Promise<{ customers?: CustomerWithDepartment[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_CUSTOMERS)) {
      return { error: "Unauthorized: You do not have permission to view customers." };
    }
    const prismaCustomers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
      include: {
        loanRequests: {
          select: {
            id: true,
            loanNumber: true,
            loanAmount: true,
            submittedDate: true,
            currentWorkflowStage: { select: { name: true } },
            assignedDepartment: { select: { name: true } },
          },
          orderBy: { submittedDate: 'desc' }
        }
      }
    });

    const appCustomers: CustomerWithDepartment[] = prismaCustomers.map(pc => {
      const mostRecentLoan = pc.loanRequests[0];
      return {
        id: pc.id,
        name: pc.name,
        email: pc.email,
        phone: pc.phone || undefined,
        branch: pc.branch || undefined,
        mostRecentDepartment: mostRecentLoan?.assignedDepartment?.name as Department | undefined,
        mostRecentStageName: mostRecentLoan?.currentWorkflowStage?.name,
        loanRequests: pc.loanRequests.map(lr => ({
          id: lr.id,
          loanNumber: lr.loanNumber,
          loanAmount: lr.loanAmount.toNumber(),
          submittedDate: formatISO(lr.submittedDate),
          currentStageName: lr.currentWorkflowStage?.name || 'Unknown'
        })),
      };
    });

    return { customers: appCustomers };
  } catch (e: any) {
    return createErrorResult("Failed to fetch customers.", "getCustomers", e);
  }
}

export async function getCustomerById(id: string): Promise<{ customer?: Customer | null; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_CUSTOMERS)) {
      return { error: "Unauthorized: You do not have permission to view customer details." };
    }
    const prismaCustomer = await prisma.customer.findUnique({
      where: { id },
      include: {
        loanRequests: {
          select: {
            id: true,
            loanNumber: true,
            loanAmount: true,
            submittedDate: true,
            currentWorkflowStage: { select: { name: true } },
          },
          orderBy: { submittedDate: 'desc' },
        },
      },
    });

    if (!prismaCustomer) {
      return { error: 'Customer not found.' };
    }

    const appCustomer: Customer = {
      id: prismaCustomer.id,
      name: prismaCustomer.name,
      email: prismaCustomer.email,
      phone: prismaCustomer.phone || undefined,
      branch: prismaCustomer.branch || undefined,
      loanRequests: prismaCustomer.loanRequests.map(lr => ({
        id: lr.id,
        loanNumber: lr.loanNumber,
        loanAmount: lr.loanAmount.toNumber(),
        submittedDate: formatISO(lr.submittedDate),
        currentStageName: lr.currentWorkflowStage?.name || 'Unknown',
      })),
    };

    return { customer: appCustomer };
  } catch (e: any) {
    return createErrorResult(`Failed to fetch customer.`, 'getCustomerById', e);
  }
}

export interface PublicLoanStatus {
  id: string; 
  loanNumber: string;
  customerName: string;
  submittedDate: string;
  currentStageId: string | null;
  currentStageStatus: string | null;
  isTerminalStage: boolean;
  // workflowSequence is removed as it's not needed for the simple table view
}


export async function searchLoanRequests(
  searchTerm: string,
  searchType: 'loanNumber' | 'customerName' | 'customerNumber'
): Promise<{ loans?: PublicLoanStatus[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_LOAN_STATUS_LOOKUP)) {
      return { error: "Unauthorized to search loans." };
    }
    let whereClause: any = {};

    switch (searchType) {
      case 'loanNumber':
        whereClause = { loanNumber: { contains: searchTerm, mode: 'insensitive' } };
        break;
      case 'customerName':
        whereClause = { customer: { name: { contains: searchTerm, mode: 'insensitive' } } };
        break;
      case 'customerNumber': // Assuming customer number is a property on the customer model
        whereClause = { customer: { id: { contains: searchTerm, mode: 'insensitive' } } }; // Example, adjust if needed
        break;
    }

    const prismaLoans = await prisma.loanRequest.findMany({
      where: whereClause,
      select: {
        id: true,
        loanNumber: true,
        submittedDate: true,
        currentStageIdMirror: true,
        currentStageStatus: true,
        isTerminalStage: true,
        customer: {
          select: {
            name: true,
          }
        },
      },
      orderBy: { lastUpdatedDate: 'desc' },
      take: 50,
    });
    
    if (prismaLoans.length === 0) {
      return { loans: [] };
    }
    
    const results: PublicLoanStatus[] = prismaLoans.map(loan => ({
        id: loan.id,
        loanNumber: loan.loanNumber,
        customerName: loan.customer.name,
        submittedDate: formatISO(loan.submittedDate),
        currentStageId: loan.currentStageIdMirror,
        currentStageStatus: loan.currentStageStatus,
        isTerminalStage: loan.isTerminalStage,
    }));

    return { loans: results };
  } catch (e: any) {
    return createErrorResult(`Search failed.`, "searchLoanRequests", e);
  }
}


export async function getPublicLoanStatusByLoanNumber(loanNumber: string): Promise<{ data?: PublicLoanStatus & { workflowSequence: { stageId: string; stageName: string; stageOrder: number; stageTimelineDays: number; departmentName: string; entryDate?: string; }[] } | null, error?: string }> {
  try {
    const prismaLoan = await prisma.loanRequest.findUnique({
      where: { loanNumber },
      include: {
        customer: { select: { name: true } },
        workflowVersion: {
          include: {
            workflowDefinition: {
              include: {
                sector: {
                  select: { parentId: true }
                }
              }
            }
          }
        },
        history: {
          select: {
            stageName: true,
            timestamp: true,
          },
          orderBy: {
            timestamp: 'asc',
          }
        }
      }
    });

    if (!prismaLoan) {
      return { error: 'Loan not found.' };
    }
    
    if (!prismaLoan.workflowVersion?.workflowDefinition.sector?.parentId) {
        return { error: 'Loan is not associated with a valid workflow path.' };
    }
    
    const parentSectorId = prismaLoan.workflowVersion.workflowDefinition.sector.parentId;

    const allWorkflowDefinitionsInPath = await prisma.workflowDefinition.findMany({
        where: { sector: { parentId: parentSectorId } },
        orderBy: { order: 'asc' },
        include: {
            versions: {
                where: { isActive: true },
                include: {
                    stages: {
                        orderBy: { order: 'asc' },
                        include: {
                            responsibleDepartment: { select: { name: true }}
                        }
                    }
                }
            },
        }
    });

    // Create a map to store the first entry date for each stage name
    const stageEntryDates = new Map<string, string>();
    for (const entry of prismaLoan.history) {
      if (!stageEntryDates.has(entry.stageName)) {
        stageEntryDates.set(entry.stageName, formatISO(entry.timestamp));
      }
    }


    const workflowSequence = allWorkflowDefinitionsInPath.flatMap(def => 
        def.versions.flatMap(v => v.stages.map(s => ({
            stageId: s.id,
            stageName: s.name,
            stageOrder: s.order,
            stageTimelineDays: s.defaultTimelineDays,
            departmentName: s.responsibleDepartment.name,
            workflowDefinitionName: def.name,
            workflowOrder: def.order,
            entryDate: stageEntryDates.get(s.name), // Get the entry date from the map
        })))
    ).sort((a,b) => {
        if(a.workflowOrder !== b.workflowOrder) {
            return a.workflowOrder - b.workflowOrder;
        }
        return a.stageOrder - b.stageOrder;
    });


    const result: PublicLoanStatus & { workflowSequence: any[] } = {
      id: prismaLoan.id,
      loanNumber: prismaLoan.loanNumber,
      customerName: prismaLoan.customer.name,
      submittedDate: formatISO(prismaLoan.submittedDate),
      currentStageId: prismaLoan.currentStageIdMirror,
      currentStageStatus: prismaLoan.currentStageStatus,
      isTerminalStage: prismaLoan.isTerminalStage,
      workflowSequence: workflowSequence,
    };

    return { data: result };

  } catch (e: any) {
    return createErrorResult("Failed to fetch public loan status.", 'getPublicLoanStatusByLoanNumber', e);
  }
}

export async function getSubmittedLoanRequests(): Promise<{ loans?: LoanRequest[], error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_OWN_SUBMITTED_CASES)) {
        return { error: "Unauthorized: You do not have permission to view your submitted cases." };
    }

    const prismaLoans = await prisma.loanRequest.findMany({
      where: { createdById: user.id },
      orderBy: { submittedDate: 'desc' },
      include: {
        customer: true,
        sector: { include: { parent: true } },
        requestType: true,
        assignedToUsers: { include: { department: true, customRole: true } },
        stageCompletedBy: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
        workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
        assignedDepartment: true,
        history: { include: { user: { include: { customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    const appLoans = prismaLoans.map(pl => mapPrismaLoanToAppLoan(pl as any));
    
    return { loans: appLoans };
  } catch (e: any) {
    return createErrorResult("Failed to fetch your submitted loan requests.", "getSubmittedLoanRequests", e);
  }
}
