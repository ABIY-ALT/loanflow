

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
  LoanType as PrismaLoanType,
  DocumentRequirement as PrismaDocumentRequirement,
} from '@prisma/client';

import { LoanDocumentStatus as PrismaLoanDocumentStatus, DocumentRequirementType as PrismaDocumentRequirementType } from '@prisma/client';

import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, LoanDocument, LoanHistoryEntry, ActiveWorkflow, DocumentRequirement } from '@/types/loan';
import { LoanDocumentStatus as AppLoanDocumentStatus, DocumentRequirementType as AppDocumentRequirementType } from '@/types/loan';
import type { AppPermission } from '@/lib/permissions';

import { formatISO, parseISO, addDays, isBefore, isValid } from 'date-fns';

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Prisma Loan Service Error (Context: ${context || 'Unknown'}): ${message}.`;
  if (originalError) {
    const errorDetails = (typeof originalError === 'object' && originalError !== null && typeof originalError.message === 'string') ? originalError.message : String(originalError);
    detailedMessage += ` Raw: ${errorDetails}`;
  }
  console.error(`[PrismaService:${context || 'Unknown'}] Error:`, detailedMessage, originalError);
  return { error: detailedMessage };
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
  };
};

const mapPrismaLoanToAppLoan = (
    prismaLoan: PrismaLoanRequest & {
        assignedToUser?: (PrismaUser & { department?: PrismaDepartment | null, customRole?: PrismaRole | null }) | null;
        currentWorkflowStage?: (PrismaWorkflowStageDefinition & { responsibleDepartment: PrismaDepartment, documentRequirements: PrismaDocumentRequirement[] }) | null;
        workflowVersion?: (PrismaWorkflowVersion & { workflowDefinition: PrismaWorkflowDefinition & { loanType: PrismaLoanType, department: PrismaDepartment } }) | null;
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
    customerNumber: prismaLoan.customerNumber,
    customerName: prismaLoan.customerName,
    customerEmail: prismaLoan.customerEmail,
    customerPhone: prismaLoan.customerPhone,
    customerBranch: prismaLoan.customerBranch || undefined,
    loanAmount: prismaLoan.loanAmount.toNumber(),
    loanType: prismaLoan.loanType,
    loanPurpose: prismaLoan.loanPurpose,

    workflowVersionId: prismaLoan.workflowVersionIdMirror || undefined,
    currentStageId: prismaLoan.currentStageIdMirror || undefined,
    currentStageStatus: prismaLoan.currentStageStatus || undefined,
    stageEntryDate: prismaLoan.stageEntryDate ? formatISO(new Date(prismaLoan.stageEntryDate)) : undefined,
    currentStageName: prismaLoan.currentWorkflowStage?.name || 'Unknown Stage',
    assignedDepartmentId: prismaLoan.assignedDepartmentId || undefined,
    assignedDepartment: prismaLoan.assignedDepartment?.name as Department | undefined || 'N/A',

    assignedTo: prismaLoan.assignedToUserId || undefined,
    submittedDate: formatISO(new Date(prismaLoan.submittedDate)),
    lastUpdatedDate: formatISO(new Date(prismaLoan.lastUpdatedDate)),
    stageDeadline: prismaLoan.stageDeadline ? formatISO(new Date(prismaLoan.stageDeadline)) : undefined,
    isReadyForManagerReview: prismaLoan.isReadyForManagerReview,
    isUrgent: prismaLoan.isUrgent,
    isOverdue: isOverdueCalc,
    isTerminalStage: !!isTerminal,
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
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline' | 'assignedTo' | 'isReadyForManagerReview' | 'currentStageId' | 'assignedDepartmentId' | 'assignedDepartment' | 'currentStageName' | 'isTerminalStage' | 'createdAt' | 'updatedAt' | 'currentStageStatus' | 'isUrgent' | 'stageEntryDate'>
  & { workflowVersionId: string; }
): Promise<{ id?: string; error?: string }> {
  try {
    const activeVersion = await prisma.workflowVersion.findFirst({
        where: {
            id: loanData.workflowVersionId,
            isActive: true,
        },
        include: {
            workflowDefinition: {
                include: { loanType: true, department: true },
            },
            stages: {
                orderBy: { order: 'asc' },
                include: { responsibleDepartment: true }
            },
        },
    });

    if (!activeVersion || !activeVersion.workflowDefinition.department || activeVersion.stages.length === 0) {
        return createErrorResult(`The selected workflow (ID: ${loanData.workflowVersionId}) is not active, has no stages, or is not linked to an initial department.`, "addLoanRequest");
    }

    const firstStage = activeVersion.stages[0];
    const initialDepartment = activeVersion.workflowDefinition.department;
    const loanTypeName = activeVersion.workflowDefinition.loanType.name;

    if (typeof firstStage.defaultTimelineDays !== 'number' || isNaN(firstStage.defaultTimelineDays) || firstStage.defaultTimelineDays < 0) {
      return createErrorResult(`Invalid defaultTimelineDays (${firstStage.defaultTimelineDays}) for stage "${firstStage.name}".`, "addLoanRequest");
    }
    const currentDate = new Date();
    const stageDeadlineDate = addDays(currentDate, firstStage.defaultTimelineDays);

    const systemUserId = 'system-prisma';
    const initialHistoryNote = `Loan application submitted. Initial Department: ${initialDepartment.name}. Workflow: ${activeVersion.workflowDefinition.name} (V${activeVersion.versionNumber}). Initial stage: ${firstStage.name}. Awaiting assignment.`;
    
    const availableStatusesForDept = firstStage.availableStatuses && typeof firstStage.availableStatuses === 'object' && !Array.isArray(firstStage.availableStatuses) ? (firstStage.availableStatuses as Record<string, string[]>)[firstStage.responsibleDepartment.name] : [];
    const initialStatus = availableStatusesForDept && availableStatusesForDept.length > 0 ? availableStatusesForDept[0] : 'Initiated';

    const newLoan = await prisma.loanRequest.create({
      data: {
        loanNumber: `LN-PSQL-${String(Date.now()).slice(-6)}`,
        customerNumber: `CUST-PSQL-${String(Date.now()).slice(-5)}`,
        customerName: loanData.customerName,
        customerEmail: loanData.customerEmail,
        customerPhone: loanData.customerPhone,
        loanAmount: loanData.loanAmount,
        loanType: loanTypeName,
        loanPurpose: loanData.loanPurpose,
        customerBranch: loanData.customerBranch,
        submittedDate: currentDate,
        lastUpdatedDate: currentDate,
        stageEntryDate: currentDate,
        stageDeadline: stageDeadlineDate,
        workflowVersion: { connect: { id: activeVersion.id } },
        currentWorkflowStage: { connect: { id: firstStage.id } },
        assignedDepartment: { connect: { id: initialDepartment.id } },
        currentStageStatus: initialStatus,
        history: {
          create: [{
            user: { connect: { id: systemUserId } },
            stageName: firstStage.name,
            timestamp: currentDate,
            notes: initialHistoryNote,
          }],
        },
      },
    });
    return { id: newLoan.id };
  } catch (e: any) {
     if (e.code === 'P2025' && e.message.includes("'User' record(s)")) {
        return createErrorResult("Failed to add loan request: The 'system-prisma' user was not found. Please ensure this user exists in the database (check seed script).", "addLoanRequest_systemUserMissing", e);
    }
    return createErrorResult("Failed to add loan request.", "addLoanRequest", e);
  }
}

export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string; users?: User[] }> {
  try {
    const prismaLoans = await prisma.loanRequest.findMany({
      orderBy: [{ isUrgent: 'desc' }, { lastUpdatedDate: 'desc' }],
      include: {
        assignedToUser: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
        workflowVersion: { include: { workflowDefinition: { include: { loanType: true, department: true } } } },
        assignedDepartment: true,
        history: { include: { user: { include: { customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    const appLoans = prismaLoans.map(pl => mapPrismaLoanToAppLoan(pl as any));

    const prismaUsers = await prisma.user.findMany({ include: { department: true, customRole: true } });
    const appUsers = prismaUsers.map(mapPrismaUserToAppUser);

    return { loans: appLoans, users: appUsers };
  } catch (e: any) {
    return createErrorResult("Failed to fetch loan requests.", "getLoanRequests", e);
  }
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string; workflowDefinitions?: WorkflowDefinition[] }> {
  try {
    const prismaLoan = await prisma.loanRequest.findUnique({
      where: { id },
      include: {
        assignedToUser: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
        workflowVersion: {
          include: {
            workflowDefinition: { include: { loanType: true, department: true } },
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
    return createErrorResult(`Failed to fetch loan request by ID: ${id}.`, "getLoanRequestById", e);
  }
}


export async function updateLoanRequest(
  id: string,
  dataToUpdate: Partial<Omit<LoanRequest, 'id'>>
): Promise<{ success?: boolean; updatedLoan?: LoanRequest; error?: string }> {
  try {
    const updatedPrismaLoan = await prisma.$transaction(async (tx) => {
      const existingLoan = await tx.loanRequest.findUnique({ where: { id }, include: { history: true, documents: true } });

      if (!existingLoan) {
        throw new Error(`Loan with ID "${id}" not found for update.`);
      }

      const updatePayload: any = { lastUpdatedDate: new Date() };

      const simpleFields: (keyof Pick<LoanRequest, 'customerName' | 'customerEmail' | 'customerPhone' | 'loanType' | 'loanPurpose' | 'isReadyForManagerReview' | 'customerBranch' | 'currentStageStatus' | 'isTerminalStage' | 'isUrgent' >)[] =
        ['customerName', 'customerEmail', 'customerPhone', 'loanType', 'loanPurpose', 'isReadyForManagerReview', 'customerBranch', 'currentStageStatus', 'isTerminalStage', 'isUrgent'];
      
      simpleFields.forEach(field => {
        if (dataToUpdate[field] !== undefined) updatePayload[field] = dataToUpdate[field];
      });
      if (dataToUpdate.loanAmount !== undefined) updatePayload.loanAmount = dataToUpdate.loanAmount;

      if (dataToUpdate.hasOwnProperty('assignedTo')) {
        updatePayload.assignedToUser = dataToUpdate.assignedTo ? { connect: { id: dataToUpdate.assignedTo } } : { disconnect: true };
      }

      if (dataToUpdate.hasOwnProperty('assignedDepartmentId')) {
        updatePayload.assignedDepartment = dataToUpdate.assignedDepartmentId ? { connect: { id: dataToUpdate.assignedDepartmentId } } : { disconnect: true };
      }

      if (dataToUpdate.currentStageId && dataToUpdate.currentStageId !== existingLoan.currentStageIdMirror) {
        const wfVerId = dataToUpdate.workflowVersionId || existingLoan.workflowVersionIdMirror;
        if (!wfVerId) throw new Error("Workflow version context missing for stage transition.");

        const newStageDef = await tx.workflowStageDefinition.findUnique({
          where: { id: dataToUpdate.currentStageId, workflowVersionId: wfVerId },
          include: { responsibleDepartment: true }
        });
        if (!newStageDef) throw new Error(`New stage definition not found for ID "${dataToUpdate.currentStageId}".`);
        
        updatePayload.currentWorkflowStage = { connect: { id: newStageDef.id } };
        updatePayload.workflowVersion = { connect: { id: wfVerId } }; // Ensure version is connected
        updatePayload.stageEntryDate = new Date();
        const newStageDeadline = addDays(new Date(), newStageDef.defaultTimelineDays);
        updatePayload.stageDeadline = newStageDeadline;
        updatePayload.isReadyForManagerReview = false;
        
        const availableStatusesForDept = newStageDef.availableStatuses && typeof newStageDef.availableStatuses === 'object' && !Array.isArray(newStageDef.availableStatuses) ? (newStageDef.availableStatuses as Record<string, string[]>)[newStageDef.responsibleDepartment.name] : [];
        updatePayload.currentStageStatus = availableStatusesForDept && availableStatusesForDept.length > 0 ? availableStatusesForDept[0] : 'Initiated';

        const isTerminal = newStageDef.name.toLowerCase().includes("closed") || newStageDef.name.toLowerCase().includes("rejected") || newStageDef.name.toLowerCase().includes("funded") || dataToUpdate.isTerminalStage === true;
        updatePayload.isTerminalStage = isTerminal;
        updatePayload.isOverdue = isBefore(newStageDeadline, new Date()) && !isTerminal;

        if (!dataToUpdate.hasOwnProperty('assignedTo')) updatePayload.assignedToUser = { disconnect: true };
        if (!dataToUpdate.hasOwnProperty('assignedDepartmentId')) updatePayload.assignedDepartment = { connect: { id: newStageDef.responsibleDepartmentId } };
      }

      if (dataToUpdate.history) {
        const existingHistoryIds = new Set(existingLoan.history.map(h => h.id));
        const newHistoryEntries = dataToUpdate.history.filter(h => !existingHistoryIds.has(h.id));
        
        for (const entry of newHistoryEntries) {
            if (!entry.userId) { // Safety check
                console.warn("Skipping history entry creation due to missing userId", entry);
                continue;
            }
            await tx.loanHistoryEntry.create({
                data: {
                    loan: { connect: { id } },
                    user: { connect: { id: entry.userId } },
                    stageName: entry.stageName,
                    timestamp: parseISO(entry.timestamp),
                    notes: entry.notes,
                    requiredFulfilment: entry.requiredFulfilment,
                }
            });
        }
      }

      if (dataToUpdate.documents !== undefined) {
          const incomingDocIds = new Set(dataToUpdate.documents.map(d => d.id));
          const docsToDelete = existingLoan.documents.filter(d => !incomingDocIds.has(d.id));

          if (docsToDelete.length > 0) {
              await tx.loanDocument.deleteMany({
                  where: { id: { in: docsToDelete.map(d => d.id) } }
              });
          }

          for (const doc of dataToUpdate.documents) {
              await tx.loanDocument.upsert({
                  where: { id: doc.id || `_non_existent_${Date.now()}` },
                  create: {
                      id: doc.id,
                      loanId: id,
                      requirementId: doc.requirementId,
                      name: doc.name,
                      status: doc.status as PrismaLoanDocumentStatus,
                      filePath: doc.filePath,
                      notes: doc.notes,
                      uploadedAt: doc.uploadedAt ? parseISO(doc.uploadedAt) : new Date()
                  },
                  update: {
                      name: doc.name,
                      status: doc.status as PrismaLoanDocumentStatus,
                      filePath: doc.filePath,
                      notes: doc.notes,
                      requirementId: doc.requirementId,
                      uploadedAt: doc.uploadedAt ? parseISO(doc.uploadedAt) : new Date(),
                      updatedAt: new Date()
                  }
              });
          }
      }

      return tx.loanRequest.update({
        where: { id },
        data: updatePayload,
        include: {
          assignedToUser: { include: { department: true, customRole: true } },
          currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
          workflowVersion: { include: { workflowDefinition: { include: { loanType: true, department: true } } } },
          assignedDepartment: true,
          history: { include: { user: { include: { customRole: true } } }, orderBy: { timestamp: 'desc' } },
          documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
        },
      });
    });
    const appLoan = mapPrismaLoanToAppLoan(updatedPrismaLoan as any);
    return { success: true, updatedLoan: appLoan };

  } catch (e: any) {
    return createErrorResult(`Failed to update loan request ID: ${id}.`, "updateLoanRequest", e);
  }
}


export async function getWorkflowDefinitions(): Promise<{ workflows?: WorkflowDefinition[]; error?: string }> {
  try {
    const prismaWorkflowDefs = await prisma.workflowDefinition.findMany({
      orderBy: { department: { name: 'asc' } },
      include: {
        loanType: true,
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
      loanTypeId: def.loanTypeId,
      loanTypeName: def.loanType.name,
      departmentId: def.departmentId,
      departmentName: def.department.name,
      description: def.description || undefined,
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
  definitionData: Omit<WorkflowDefinition, 'id' | 'versions' | 'createdAt' | 'updatedAt' | 'loanTypeName' | 'departmentName'>
): Promise<{ id?: string; error?: string }> {
  try {
    const existing = await prisma.workflowDefinition.findUnique({
      where: { departmentId_loanTypeId: { departmentId: definitionData.departmentId, loanTypeId: definitionData.loanTypeId } },
    });
    if (existing) {
      return createErrorResult(`A workflow definition for this department and loan type combination already exists.`, "addWorkflowDefinition");
    }

    const newDef = await prisma.workflowDefinition.create({
      data: {
        name: definitionData.name,
        department: { connect: { id: definitionData.departmentId } },
        loanType: { connect: { id: definitionData.loanTypeId } },
        description: definitionData.description,
      },
    });
    return { id: newDef.id };
  } catch (e: any) {
    return createErrorResult("Failed to add workflow definition.", "addWorkflowDefinition", e);
  }
}

export async function saveWorkflowDefinitions(definitions: WorkflowDefinition[]): Promise<{ success?: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      for (const definition of definitions) {
        const { versions, ...defData } = definition;

        const upsertedDef = await tx.workflowDefinition.upsert({
          where: { id: definition.id || `_non_existent_def_id_${Date.now()}` },
          create: {
            id: definition.id || undefined,
            name: defData.name,
            description: defData.description,
            department: { connect: { id: defData.departmentId } },
            loanType: { connect: { id: defData.loanTypeId } }
          },
          update: {
            name: defData.name,
            description: defData.description,
            department: { connect: { id: defData.departmentId } },
            loanType: { connect: { id: defData.loanTypeId } },
            updatedAt: new Date(),
          },
        });
        const definitionId = upsertedDef.id;

        const existingDbVersionIds = (await tx.workflowVersion.findMany({ where: { workflowDefinitionId: definitionId }, select: { id: true }})).map(v => v.id);
        const uiVersionIds = new Set(versions.map(v => v.id).filter(Boolean));
        const versionsToDelete = existingDbVersionIds.filter(id => !uiVersionIds.has(id));
        if (versionsToDelete.length > 0) {
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

            // Handle document requirements
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
    const stagesUsingDept = await prisma.workflowStageDefinition.count({ where: { responsibleDepartmentId: departmentId } });
    if (stagesUsingDept > 0) {
        return createErrorResult(`Cannot delete department. It is assigned to ${stagesUsingDept} workflow stage(s).`, "deleteDepartment_inUseStages");
    }
     const usersInDept = await prisma.user.count({ where: { departmentId: departmentId } });
     if (usersInDept > 0) {
        return createErrorResult(`Cannot delete department. It is assigned to ${usersInDept} user(s).`, "deleteDepartment_inUseUsers");
    }

    await prisma.department.delete({ where: { id: departmentId } });
    return { success: true };
  } catch (e: any) {
    if ((e as any).code === 'P2003' || (e as any).message?.includes("foreign key constraint")) {
      return createErrorResult(`Cannot delete department due to existing references.`, "deleteDepartment_constraint", e);
    }
    return createErrorResult(`Failed to delete department ID: ${departmentId}.`, "deleteDepartment", e);
  }
}

export async function getAvailableLoanTypesForWorkflow(): Promise<{ loanTypes?: string[]; error?: string }> {
  try {
    const definitionsWithActiveVersions = await prisma.workflowDefinition.findMany({
      where: {
        versions: {
          some: {
            isActive: true,
          },
        },
      },
      include: {
        loanType: true,
      },
    });

    const loanTypeNames = new Set(
      definitionsWithActiveVersions.map(def => def.loanType.name)
    );

    const sortedLoanTypes = Array.from(loanTypeNames).sort();

    return { loanTypes: sortedLoanTypes };
  } catch (e: any) {
    return createErrorResult("Failed to fetch available loan types with active workflows.", "getAvailableLoanTypesForWorkflow", e);
  }
}

export async function getActiveWorkflowsForCreate(): Promise<{ activeWorkflows?: ActiveWorkflow[]; error?: string }> {
  try {
    const activeVersions = await prisma.workflowVersion.findMany({
      where: {
        isActive: true,
        workflowDefinition: {
          departmentId: { not: null }, // Ensure it has a starting department
        },
        stages: {
          some: {} // Ensure it has at least one stage
        }
      },
      include: {
        workflowDefinition: {
          include: {
            loanType: true,
            department: true,
          }
        }
      },
      orderBy: [
        { workflowDefinition: { loanType: { name: 'asc' }}},
        { workflowDefinition: { name: 'asc' }}
      ]
    });

    const mappedWorkflows: ActiveWorkflow[] = activeVersions.map(v => ({
      id: v.id,
      name: `${v.workflowDefinition.name} (v${v.versionNumber})`,
      loanTypeName: v.workflowDefinition.loanType.name,
      departmentName: v.workflowDefinition.department.name,
    }));

    return { activeWorkflows: mappedWorkflows };
  } catch (e: any) {
    return createErrorResult("Failed to fetch active workflows for creation.", "getActiveWorkflowsForCreate", e);
  }
}
