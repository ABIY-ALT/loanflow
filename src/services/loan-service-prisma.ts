
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

import { DocumentRequirementType as PrismaDocumentRequirementType } from '@prisma/client';

import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, LoanDocument, LoanHistoryEntry, DocumentRequirement, Customer, CustomerWithDepartment, Sector, RequestType } from '@/types/loan';
import { LoanDocumentStatus as AppLoanDocumentStatus, DocumentRequirementType as AppDocumentRequirementType } from '@/types/loan';
import { PERMISSIONS, type AppPermission } from '@/lib/permissions';
import { getCurrentUser } from '@/app/auth/actions';

import { formatISO, parseISO, addDays, isBefore, isValid } from 'date-fns';

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  console.error(`[PrismaService:${context || 'Unknown'}] Error: ${message}`, originalError);
  return { error: message };
};

/**
 * Helper to safely parse JSON strings or return the object if already parsed
 */
function safeJsonParse<T>(value: any, defaultValue: T): T {
  if (typeof value === 'object' && value !== null) return value as T;
  try {
    return value ? JSON.parse(value) : defaultValue;
  } catch (error) {
    return defaultValue;
  }
}

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
    permissions: safeJsonParse<AppPermission[]>(prismaUser.customRole?.permissions, []),
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
        assignedBy?: PrismaUser | null;
        history?: (PrismaLoanHistoryEntry & { user?: (PrismaUser & { department?: PrismaDepartment | null, customRole?: PrismaRole | null }) | null })[];
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
    currentStageName: prismaLoan.currentWorkflowStage?.name || 'Unknown Stage',
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
    createdById: prismaLoan.createdById || undefined,
    history: prismaLoan.history?.map((h) => ({
      id: h.id,
      userId: h.userId,
      userName: h.user?.name || (h.userId === 'system-prisma' ? 'System Process' : 'Unknown User'),
      userRole: h.user?.customRole?.name || undefined,
      userDepartment: h.user?.department?.name || undefined,
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
    createdAt: formatISO(new Date(prismaLoan.createdAt)),
    updatedAt: formatISO(new Date(prismaLoan.updatedAt)),
  };
};

/**
 * SERVICE LAYER (Internal Logic)
 */

async function addLoanRequestInternal(
  user: User,
  loanData: any
): Promise<{ id?: string; error?: string }> {
  try {
    const selectedChildSector = await prisma.sector.findUnique({
        where: { id: loanData.sectorId },
        include: { parent: true }
    });
    if (!selectedChildSector || !selectedChildSector.parentId) {
        return createErrorResult("Invalid child sector selected or it has no parent.", "addLoanRequestInternal");
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
        return createErrorResult(`No workflow sequence found for the selected Child Sector.`, "addLoanRequestInternal");
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
        return createErrorResult(`The first workflow in the sequence has no active version or is improperly configured.`, "addLoanRequestInternal");
    }

    const firstStage = activeVersion.stages[0];
    const initialDepartment = activeVersion.workflowDefinition.department;
    const currentDate = new Date();
    const stageDeadlineDate = addDays(currentDate, firstStage.defaultTimelineDays);

    const systemUserId = 'system-prisma';
    const initialHistoryNote = `Loan application submitted by ${user.fullName}. Initial Department: ${initialDepartment.name}. Workflow: ${firstWorkflowInSequence.name} (V${activeVersion.versionNumber}). Initial stage: ${firstStage.name}. Awaiting assignment.`;
    
    const availableStatusesObj = safeJsonParse(firstStage.availableStatuses, {});
    const availableStatusesForDept = availableStatusesObj[firstStage.responsibleDepartment.name] || [];
    const initialStatus = availableStatusesForDept.length > 0 ? availableStatusesForDept[0] : 'Initiated';

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
        createdBy: { connect: { id: user.id } },
        history: {
          create: [
            {
              stageName: firstStage.name,
              timestamp: currentDate,
              notes: initialHistoryNote,
              user: { connect: { id: systemUserId } }
            }
          ]
        }
      },
    });

    return { id: newLoan.id };
  } catch (e: any) {
    return createErrorResult(`Failed to add loan request. ${e.message}`, "addLoanRequestInternal", e);
  }
}

async function getLoanRequestsInternal(user: User): Promise<{ loans?: LoanRequest[], error?: string }> {
  try {
    const userPermissions = new Set(user.permissions || []);
    let whereClause: any = {};

    const isFullAdmin = userPermissions.has(PERMISSIONS.MANAGE_USERS);

    if (isFullAdmin) {
      whereClause = {};
    } else {
      const orConditions: any[] = [
        { createdBy: { id: user.id } },
        { assignedBy: { id: user.id } },
        { assignedToUsers: { some: { id: user.id } } }
      ];

      if (user.departmentId) {
        orConditions.push({ assignedDepartmentId: user.departmentId });
      }

      whereClause = {
        OR: orConditions
      };
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
        assignedBy: true,
        history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    const appLoans = prismaLoans.map(pl => mapPrismaLoanToAppLoan(pl as any));
    return { loans: appLoans };
  } catch (e: any) {
    return createErrorResult("Failed to fetch loan requests.", "getLoanRequestsInternal", e);
  }
}

/**
 * CONTROLLER LAYER (Exported Actions)
 */

export async function addLoanRequest(loanData: any) {
  const { user } = await getCurrentUser();
  if (!user || !user.permissions.includes(PERMISSIONS.CREATE_LOAN_REQUEST)) {
      return createErrorResult("Unauthorized", "addLoanRequest");
  }
  return addLoanRequestInternal(user, loanData);
}

export async function getLoanRequests() {
  const { user } = await getCurrentUser();
  if (!user) return createErrorResult("Unauthorized", "getLoanRequests");
  return getLoanRequestsInternal(user);
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string; workflowDefinitions?: WorkflowDefinition[] }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return { error: "Unauthorized" };

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
        assignedBy: true,
        history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    if (!prismaLoan) {
      return { loan: null, users: [], error: `Loan not found.` };
    }

    const isCreator = prismaLoan.createdById === user.id;
    const hasFullView = user.permissions.includes(PERMISSIONS.VIEW_LOAN_DETAILS);

    if (!hasFullView && !isCreator) {
        return { error: "Unauthorized access to this loan record." };
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
  dataToUpdate: Partial<Omit<LoanRequest, 'id'>> & { respondToInfoRequest?: { entryId: string, response: string, markFulfilled: boolean } }
): Promise<{ success?: boolean; updatedLoan?: LoanRequest; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "updateLoanRequest");
    
    const existingLoan = await prisma.loanRequest.findUnique({ where: { id }, include: { history: true, documents: true } });
    if (!existingLoan) throw new Error(`Loan not found.`);
    
    const updatedPrismaLoan = await prisma.$transaction(async (tx) => {
      const updatePayload: any = { lastUpdatedDate: new Date() };
      
      const simpleFields: (keyof Pick<LoanRequest, 'loanPurpose' | 'isReadyForManagerReview' | 'currentStageStatus' | 'isTerminalStage' | 'isUrgent'>)[] = ['loanPurpose', 'isReadyForManagerReview', 'currentStageStatus', 'isTerminalStage', 'isUrgent'];
      simpleFields.forEach(field => {
        if (dataToUpdate[field] !== undefined) updatePayload[field] = dataToUpdate[field];
      });

      if (dataToUpdate.loanAmount !== undefined) {
        updatePayload.loanAmount = dataToUpdate.loanAmount;
      }
      
      if (dataToUpdate.hasOwnProperty('assignedToUsers')) {
        const userIds = dataToUpdate.assignedToUsers?.map(u => ({ id: u.id })) || [];
        updatePayload.assignedToUsers = { set: userIds };
        updatePayload.assignedBy = { connect: { id: user.id } };
      }

      if (dataToUpdate.hasOwnProperty('stageCompletedBy')) {
          const userIds = dataToUpdate.stageCompletedBy?.map(u => ({ id: u.id })) || [];
          updatePayload.stageCompletedBy = { set: userIds };
      }

      // VITAL: Handle Stage Transition and Department Update
      if (dataToUpdate.currentStageId && dataToUpdate.currentStageId !== existingLoan.currentStageId) {
        const wfVerId = dataToUpdate.workflowVersionId || existingLoan.workflowVersionId;
        if (!wfVerId) throw new Error("Workflow version ID missing for transition.");

        const newStageDef = await tx.workflowStageDefinition.findUnique({
          where: { id: dataToUpdate.currentStageId },
          include: { responsibleDepartment: true }
        });
        if (!newStageDef) throw new Error(`Stage definition not found.`);
        
        updatePayload.currentWorkflowStage = { connect: { id: newStageDef.id } };
        updatePayload.workflowVersion = { connect: { id: wfVerId } }; 
        updatePayload.stageEntryDate = new Date();
        updatePayload.stageDeadline = addDays(new Date(), newStageDef.defaultTimelineDays);
        
        updatePayload.isReadyForManagerReview = false;
        updatePayload.stageCompletedBy = { set: [] };
        updatePayload.assignedToUsers = { set: [] };
        
        updatePayload.assignedBy = { disconnect: true };
        
        updatePayload.assignedDepartment = { connect: { id: newStageDef.responsibleDepartmentId } };
        
        const availableStatusesObj = safeJsonParse(newStageDef.availableStatuses, {});
        const availableStatusesForDept = availableStatusesObj[newStageDef.responsibleDepartment.name] || [];
        updatePayload.currentStageStatus = availableStatusesForDept.length > 0 ? availableStatusesForDept[0] : 'Initiated';
      }

      if (dataToUpdate.respondToInfoRequest) {
          const { entryId, response, markFulfilled } = dataToUpdate.respondToInfoRequest;
          await tx.loanHistoryEntry.update({
              where: { id: entryId },
              data: {
                  fulfillmentNotes: response,
                  isFulfilled: markFulfilled,
                  updatedAt: new Date()
              }
          });
      }

      if (dataToUpdate.hasOwnProperty('history')) {
        const existingHistoryIds = new Set((existingLoan.history || []).map(h => h.id));
        const newEntries = (dataToUpdate.history || []).filter(h => !existingHistoryIds.has(h.id));
        for (const entry of newEntries) {
            await tx.loanHistoryEntry.create({
                data: {
                    loanRequest: { connect: { id } },
                    user: { connect: { id: entry.userId } },
                    stageName: entry.stageName,
                    timestamp: parseISO(entry.timestamp),
                    notes: entry.notes,
                    requiredFulfilment: entry.requiredFulfilment,
                    fulfillmentNotes: entry.fulfillmentNotes,
                    isFulfilled: entry.isFulfilled || false,
                }
            });
        }
      }

      if (dataToUpdate.documents !== undefined) {
        const currentDocIds = new Set(existingLoan.documents.map(d => d.id));
        const updatedDocIds = new Set(dataToUpdate.documents.map(d => d.id));
        const docsToAdd = dataToUpdate.documents.filter(d => !currentDocIds.has(d.id));
        const docsToDelete = existingLoan.documents.filter(d => !updatedDocIds.has(d.id));
        const docsToUpdate = dataToUpdate.documents.filter(d => currentDocIds.has(d.id));

        if (docsToDelete.length > 0) {
            await tx.loanDocument.deleteMany({ where: { id: { in: docsToDelete.map(d => d.id) } } });
        }
        for (const doc of docsToAdd) {
            await tx.loanDocument.create({
                data: {
                    loanRequest: { connect: { id } },
                    requirement: doc.requirementId ? { connect: { id: doc.requirementId } } : undefined,
                    name: doc.name,
                    status: doc.status,
                    filePath: doc.filePath,
                    notes: doc.notes,
                    uploadedAt: doc.uploadedAt ? parseISO(doc.uploadedAt) : undefined,
                },
            });
        }
        for (const doc of docsToUpdate) {
            await tx.loanDocument.update({
                where: { id: doc.id },
                data: { status: doc.status, notes: doc.notes, filePath: doc.filePath },
            });
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
          assignedBy: true,
          history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } },
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
    if (!user) return { error: "Unauthorized" };
    
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
          availableStatuses: safeJsonParse(s.availableStatuses, {}),
          allowedRoles: safeJsonParse(s.allowedRoles, []),
          requiresApproval: s.requiresApproval,
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

        for (const version of versions) {
          const { stages, ...versionData } = version;
          const upsertedVersion = await tx.workflowVersion.upsert({
            where: { id: version.id || `_non_existent_ver_id_${Date.now()}` },
            create: { ...versionData, id: version.id || undefined, workflowDefinition: { connect: { id: definitionId } } },
            update: { ...versionData, id: undefined, updatedAt: new Date() },
          });
          const versionId = upsertedVersion.id;

          for (const stage of stages) {
             const department = await tx.department.findUnique({ where: {nameLowercase: stage.responsibleDepartment.toLowerCase() }});
             if (!department) throw new Error(`Department "${stage.responsibleDepartment}" not found.`);
            const { documentRequirements, ...stageData } = stage;
            const upsertedStage = await tx.workflowStageDefinition.upsert({
              where: { id: stage.id || `_non_existent_stage_id_${Date.now()}` },
              create: { ...stageData, id: stage.id || undefined, availableStatuses: JSON.stringify(stage.availableStatuses || {}), allowedRoles: JSON.stringify(stage.allowedRoles || []), requiresApproval: stage.requiresApproval, workflowVersion: { connect: { id: versionId } }, responsibleDepartment: { connect: { id: department.id } } },
              update: { ...stageData, id: undefined, availableStatuses: JSON.stringify(stage.availableStatuses || {}), allowedRoles: JSON.stringify(stage.allowedRoles || []), requiresApproval: stage.requiresApproval, updatedAt: new Date(), responsibleDepartment: { connect: { id: department.id } } },
            });

            for (const req of documentRequirements) {
                await tx.documentRequirement.upsert({
                    where: { id: req.id || `_non_existent_req_id_${Date.now()}` },
                    create: { id: req.id || undefined, name: req.name, isMandatory: req.isMandatory, type: req.type, workflowStage: { connect: { id: upsertedStage.id } } },
                    update: { name: req.name, isMandatory: req.isMandatory, type: req.type },
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
    if (!user) return { error: "Unauthorized" };
    const prismaDepartments = await prisma.department.findMany({ orderBy: { name: 'asc' } });
    return { departments: prismaDepartments.map(d => ({ id: d.id, name: d.name as Department })) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch departments.", "getDepartments", e);
  }
}

export async function addDepartment(departmentName: string): Promise<{ id?: string; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS)) return createErrorResult("Unauthorized", "addDepartment");
    const nameLower = departmentName.trim().toLowerCase();
    const existing = await prisma.department.findUnique({ where: { nameLowercase: nameLower } });
    if (existing) return createErrorResult(`Department already exists.`, "addDepartment");
    const newDepartment = await prisma.department.create({ data: { name: departmentName.trim(), nameLowercase: nameLower } });
    return { id: newDepartment.id };
  } catch (e: any) {
    return createErrorResult("Failed to add department.", "addDepartment", e);
  }
}

export async function deleteDepartment(departmentId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS)) return createErrorResult("Unauthorized", "deleteDepartment");
    await prisma.department.delete({ where: { id: departmentId } });
    return { success: true };
  } catch (e: any) {
    return createErrorResult(`Failed to delete department.`, "deleteDepartment", e);
  }
}

export async function getCustomers(): Promise<{ customers?: CustomerWithDepartment[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_CUSTOMERS)) return { error: "Unauthorized" };
    const prismaCustomers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
      include: { loanRequests: { include: { currentWorkflowStage: true, assignedDepartment: true }, orderBy: { submittedDate: 'desc' } } }
    });
    const appCustomers: CustomerWithDepartment[] = prismaCustomers.map(pc => {
      const mostRecentLoan = pc.loanRequests[0];
      return {
        id: pc.id, name: pc.name, email: pc.email, phone: pc.phone || undefined, branch: pc.branch || undefined,
        mostRecentDepartment: mostRecentLoan?.assignedDepartment?.name as Department | undefined,
        mostRecentStageName: mostRecentLoan?.currentWorkflowStage?.name,
        loanRequests: pc.loanRequests.map(lr => ({ id: lr.id, loanNumber: lr.loanNumber, loanAmount: Number(lr.loanAmount), submittedDate: formatISO(lr.submittedDate), currentStageName: lr.currentWorkflowStage?.name || 'Unknown' })),
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
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_CUSTOMERS)) return { error: "Unauthorized" };
    const prismaCustomer = await prisma.customer.findUnique({
      where: { id },
      include: { loanRequests: { include: { currentWorkflowStage: true }, orderBy: { submittedDate: 'desc' } } },
    });
    if (!prismaCustomer) return { error: 'Customer not found.' };
    const appCustomer: Customer = {
      id: prismaCustomer.id, name: prismaCustomer.name, email: prismaCustomer.email, phone: prismaCustomer.phone || undefined, branch: prismaCustomer.branch || undefined,
      loanRequests: prismaCustomer.loanRequests.map(lr => ({ id: lr.id, loanNumber: lr.loanNumber, loanAmount: Number(lr.loanAmount), submittedDate: formatISO(lr.submittedDate), currentStageName: lr.currentWorkflowStage?.name || 'Unknown' })),
    };
    return { customer: appCustomer };
  } catch (e: any) {
    return createErrorResult(`Failed to fetch customer.`, 'getCustomerById', e);
  }
}

export async function searchLoanRequests(searchTerm: string, searchType: string): Promise<{ loans?: { id: string, loanNumber: string, customerName: string, submittedDate: string, currentStageId: string | null, currentStageStatus: string | null, isTerminalStage: boolean }[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_LOAN_STATUS_LOOKUP)) return { error: "Unauthorized" };
    let whereClause: any = {};
    if (searchType === 'loanNumber') whereClause = { loanNumber: { contains: searchTerm } };
    else if (searchType === 'customerName') whereClause = { customer: { name: { contains: searchTerm } } };
    else whereClause = { customer: { id: { contains: searchTerm } } };

    const prismaLoans = await prisma.loanRequest.findMany({
      where: whereClause,
      select: { id: true, loanNumber: true, submittedDate: true, currentStageId: true, currentStageStatus: true, isTerminalStage: true, customer: { select: { name: true } } },
      orderBy: { lastUpdatedDate: 'desc' },
      take: 50,
    });
    return { loans: prismaLoans.map(loan => ({ id: loan.id, loanNumber: loan.loanNumber, customerName: loan.customer.name, submittedDate: formatISO(loan.submittedDate), currentStageId: loan.currentStageId, currentStageStatus: loan.currentStageStatus, isTerminalStage: loan.isTerminalStage })) };
  } catch (e: any) {
    return createErrorResult(`Search failed.`, "searchLoanRequests", e);
  }
}

export async function getSubmittedLoanRequests(): Promise<{ loans?: LoanRequest[], error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_OWN_SUBMITTED_CASES)) return { error: "Unauthorized" };
    const prismaLoans = await prisma.loanRequest.findMany({
      where: { createdBy: { id: user.id } }, 
      orderBy: { submittedDate: 'desc' },
      include: { customer: true, sector: { include: { parent: true } }, requestType: true, assignedToUsers: { include: { department: true, customRole: true } }, stageCompletedBy: { include: { department: true, customRole: true } }, currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } }, workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } }, assignedDepartment: true, assignedBy: true, history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } }, documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } } },
    });
    return { loans: prismaLoans.map(pl => mapPrismaLoanToAppLoan(pl as any)) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch submitted loans.", "getSubmittedLoanRequests", e);
  }
}

export async function getPublicLoanStatusByLoanNumber(loanNumber: string) {
  try {
    const prismaLoan = await prisma.loanRequest.findUnique({
      where: { loanNumber },
      include: {
        customer: { select: { name: true } },
        workflowVersion: { include: { workflowDefinition: { include: { sector: { select: { parentId: true } } } } } },
        history: { select: { stageName: true, timestamp: true }, orderBy: { timestamp: 'asc' } }
      }
    });
    if (!prismaLoan || !prismaLoan.workflowVersion?.workflowDefinition.sector?.parentId) return { error: 'Loan not found or path invalid.' };
    const parentId = prismaLoan.workflowVersion.workflowDefinition.sector.parentId;
    const allDefs = await prisma.workflowDefinition.findMany({ where: { sector: { parentId } }, orderBy: { order: 'asc' }, include: { versions: { where: { isActive: true }, include: { stages: { orderBy: { order: 'asc' }, include: { responsibleDepartment: true } } } } } });
    const stageEntryDates = new Map<string, string>();
    for (const entry of prismaLoan.history) if (!stageEntryDates.has(entry.stageName)) stageEntryDates.set(entry.stageName, formatISO(entry.timestamp));
    const workflowSequence = allDefs.flatMap(def => def.versions.flatMap(v => v.stages.map(s => ({ stageId: s.id, stageName: s.name, stageOrder: s.order, stageTimelineDays: s.defaultTimelineDays, departmentName: s.responsibleDepartment.name, workflowDefinitionName: def.name, workflowOrder: def.order, entryDate: stageEntryDates.get(s.name) })))).sort((a,b) => a.workflowOrder !== b.workflowOrder ? a.workflowOrder - b.workflowOrder : a.stageOrder - b.stageOrder);
    return { data: { id: prismaLoan.id, loanNumber: prismaLoan.loanNumber, customerName: prismaLoan.customer.name, submittedDate: formatISO(prismaLoan.submittedDate), currentStageId: prismaLoan.currentStageId, currentStageStatus: prismaLoan.currentStageStatus, isTerminalStage: prismaLoan.isTerminalStage, workflowSequence } };
  } catch (e: any) {
    return createErrorResult("Failed to fetch public loan status.", 'getPublicLoanStatusByLoanNumber', e);
  }
}
