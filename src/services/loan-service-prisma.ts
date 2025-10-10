

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
  Role as PrismaRole, // Import PrismaRole
} from '@prisma/client';

import { LoanDocumentStatus as PrismaLoanDocumentStatus } from '@prisma/client';

import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, LoanDocument, LoanHistoryEntry } from '@/types/loan';
import { LoanDocumentStatus as AppLoanDocumentStatus } from '@/types/loan';
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

// Updated to map to the new App User type
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
        currentWorkflowStage?: (PrismaWorkflowStageDefinition & { responsibleDepartment: PrismaDepartment }) | null;
        workflowVersion?: (PrismaWorkflowVersion & { workflowDefinition: PrismaWorkflowDefinition }) | null;
        history?: (PrismaLoanHistoryEntry & { user?: (PrismaUser & { customRole?: PrismaRole | null }) | null })[];
        documents?: PrismaLoanDocument[];
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

    workflowDefinitionId: prismaLoan.workflowDefinitionIdMirror,
    workflowVersionId: prismaLoan.workflowVersionIdMirror,
    currentStageId: prismaLoan.currentStageIdMirror,
    currentStageStatus: prismaLoan.currentStageStatus || undefined,

    currentStageName: prismaLoan.currentWorkflowStage?.name || 'Unknown Stage',
    assignedDepartment: prismaLoan.currentWorkflowStage?.responsibleDepartment?.name as Department | undefined || 'N/A',

    assignedTo: prismaLoan.assignedToUserId || undefined,
    submittedDate: formatISO(new Date(prismaLoan.submittedDate)),
    lastUpdatedDate: formatISO(new Date(prismaLoan.lastUpdatedDate)),
    stageDeadline: prismaLoan.stageDeadline ? formatISO(new Date(prismaLoan.stageDeadline)) : undefined,
    isReadyForManagerReview: prismaLoan.isReadyForManagerReview,
    isOverdue: isOverdueCalc,
    isTerminalStage: isTerminal,
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
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline' | 'assignedTo' | 'isReadyForManagerReview' | 'workflowDefinitionId' | 'workflowVersionId' | 'currentStageId' | 'assignedDepartment' | 'currentStageName' | 'isTerminalStage' | 'createdAt' | 'updatedAt' | 'currentStageStatus'>
): Promise<{ id?: string; error?: string }> {
  try {
    const activeWorkflowVersion = await prisma.workflowVersion.findFirst({
      where: {
        workflowDefinition: {
          loanType: loanData.loanType,
        },
        isActive: true,
        stages: { some: {} }
      },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          take: 1,
          include: { responsibleDepartment: true }
        },
        workflowDefinition: true,
      },
    });

    if (!activeWorkflowVersion || !activeWorkflowVersion.stages || activeWorkflowVersion.stages.length === 0 || !activeWorkflowVersion.workflowDefinition || !activeWorkflowVersion.stages[0].responsibleDepartment) {
      return createErrorResult(`No active workflow version with stages and responsible department found for loan type "${loanData.loanType}". Ensure an active version with stages (and departments for stages) is configured in Settings and properly saved.`, "addLoanRequest");
    }

    const firstStage = activeWorkflowVersion.stages[0];

    if (typeof firstStage.defaultTimelineDays !== 'number' || isNaN(firstStage.defaultTimelineDays) || firstStage.defaultTimelineDays < 0) {
      return createErrorResult(
        `Invalid or negative defaultTimelineDays (${firstStage.defaultTimelineDays}) for the first stage ("${firstStage.name}").`, "addLoanRequest"
      );
    }

    const currentDate = new Date();
    const stageDeadlineDate = addDays(currentDate, firstStage.defaultTimelineDays);

    if (!isValid(stageDeadlineDate)) {
      return createErrorResult("Failed to calculate a valid stageDeadlineDate.", "addLoanRequest");
    }

    const systemUserId = 'system-prisma'; // Ensure this user exists in your User table
    const initialHistoryNote = `Loan application submitted. Workflow: ${activeWorkflowVersion.workflowDefinition.name} (V${activeWorkflowVersion.versionNumber}). Initial stage: ${firstStage.name}. Awaiting assignment in ${firstStage.responsibleDepartment.name}. Branch: ${loanData.customerBranch || 'N/A'}.`;
    const initialStatus = firstStage.availableStatuses && firstStage.availableStatuses.length > 0 ? firstStage.availableStatuses[0] : 'Initiated';

    const newLoan = await prisma.loanRequest.create({
      data: {
        loanNumber: `LN-PSQL-${String(Date.now()).slice(-6)}`,
        customerNumber: `CUST-PSQL-${String(Date.now()).slice(-5)}`,
        customerName: loanData.customerName,
        customerEmail: loanData.customerEmail,
        customerPhone: loanData.customerPhone,
        customerBranch: loanData.customerBranch,
        loanAmount: loanData.loanAmount,
        loanType: loanData.loanType,
        loanPurpose: loanData.loanPurpose,

        workflowDefinitionIdMirror: activeWorkflowVersion.workflowDefinition.id,
        workflowVersionIdMirror: activeWorkflowVersion.id,
        currentStageIdMirror: firstStage.id,
        currentStageStatus: initialStatus,

        submittedDate: currentDate,
        lastUpdatedDate: currentDate,
        stageEntryDate: currentDate,
        stageDeadline: stageDeadlineDate,
        isReadyForManagerReview: false,
        isOverdue: false,
        isTerminalStage: false,
        assignedToUserId: null,

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
    if (e.code === 'P2025' && e.message.includes("'User' record(s) (needed to inline the relation on 'LoanHistoryEntry' record(s)) was not found")) {
        return createErrorResult("Failed to add loan request: The 'system-prisma' user ID was not found. Please ensure this user exists in the database (check seed script).", "addLoanRequest_systemUserMissing", e);
    }
    return createErrorResult("Failed to add loan request.", "addLoanRequest", e);
  }
}

export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string; users?: User[] }> {
  try {
    const prismaLoans = await prisma.loanRequest.findMany({
      orderBy: { lastUpdatedDate: 'desc' },
      include: {
        assignedToUser: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true } },
        workflowVersion: { include: { workflowDefinition: true } },
        history: { include: { user: { include: { customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { orderBy: { createdAt: 'asc' } },
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
        currentWorkflowStage: { include: { responsibleDepartment: true } },
        workflowVersion: {
          include: {
            workflowDefinition: true,
            stages: { orderBy: { order: 'asc' }, include: {responsibleDepartment: true} },
          },
        },
        history: { include: { user: { include: { customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { orderBy: { createdAt: 'asc' } },
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
      const existingLoan = await tx.loanRequest.findUnique({
        where: { id },
        include: { currentWorkflowStage: { include: { responsibleDepartment: true }} }
      });

      if (!existingLoan) {
        throw new Error(`Loan with ID "${id}" not found for update.`);
      }

      const updatePayload: any = {
        lastUpdatedDate: new Date(),
      };

      const simpleFields: (keyof Pick<LoanRequest, 'customerName' | 'customerEmail' | 'customerPhone' | 'loanType' | 'loanPurpose' | 'isReadyForManagerReview' | 'customerBranch' | 'currentStageStatus' >)[] =
        ['customerName', 'customerEmail', 'customerPhone', 'loanType', 'loanPurpose', 'isReadyForManagerReview', 'customerBranch', 'currentStageStatus'];
      simpleFields.forEach(field => {
        if (dataToUpdate[field] !== undefined) {
          updatePayload[field] = dataToUpdate[field];
        }
      });
      if (dataToUpdate.loanAmount !== undefined && dataToUpdate.loanAmount !== null) {
        updatePayload.loanAmount = dataToUpdate.loanAmount;
      }

      if (dataToUpdate.hasOwnProperty('assignedTo')) {
          if (dataToUpdate.assignedTo) {
            updatePayload.assignedToUser = { connect: { id: dataToUpdate.assignedTo }};
          } else {
            updatePayload.assignedToUser = { disconnect: true };
          }
      }

      if (dataToUpdate.history && dataToUpdate.history.length > 0) {
        for (const entry of dataToUpdate.history) {
           let effectiveUserId = entry.userId;
           let notesSuffix = '';
           
           if (entry.userId !== 'system-prisma') {
             const userExists = await tx.user.findUnique({ where: { id: entry.userId } });
             if (!userExists) {
               console.error(`[Critical] User with ID ${entry.userId} for history entry (ID: ${entry.id || 'new'}) not found. Falling back to 'system-prisma' user.`);
               notesSuffix = ` (Original intended user ID: ${entry.userId} - not found, logged by system)`;
               effectiveUserId = 'system-prisma';
             }
           }

          await tx.loanHistoryEntry.upsert({
            where: { id: entry.id || `_non_existent_hist_id_${Date.now()}` },
            create: {
              id: entry.id || undefined,
              loanRequest: { connect: { id } },
              user: { connect: { id: effectiveUserId } },
              stageName: entry.stageName,
              timestamp: isValid(parseISO(entry.timestamp)) ? parseISO(entry.timestamp) : new Date(),
              notes: (entry.notes || '') + notesSuffix,
              requiredFulfilment: entry.requiredFulfilment,
            },
            update: { 
              notes: (entry.notes || '') + notesSuffix,
              requiredFulfilment: entry.requiredFulfilment,
              updatedAt: new Date(),
              ...(effectiveUserId !== entry.userId && { user: { connect: { id: effectiveUserId } } }),
            },
          });
        }
      }

      if (dataToUpdate.documents && dataToUpdate.documents.length > 0) {
        for (const doc of dataToUpdate.documents) {
          await tx.loanDocument.upsert({
            where: { id: doc.id || `_non_existent_doc_id_for_loan_${id}_${Date.now()}` },
            create: {
              id: doc.id || undefined,
              loanRequest: { connect: { id } },
              name: doc.name,
              status: doc.status as PrismaLoanDocumentStatus,
              notes: doc.notes,
              filePath: doc.filePath,
              uploadedAt: doc.uploadedAt ? (isValid(parseISO(doc.uploadedAt)) ? parseISO(doc.uploadedAt) : new Date()) : null,
            },
            update: {
              name: doc.name,
              status: doc.status as PrismaLoanDocumentStatus,
              notes: doc.notes,
              filePath: doc.filePath,
              uploadedAt: doc.uploadedAt ? (isValid(parseISO(doc.uploadedAt)) ? parseISO(doc.uploadedAt) : new Date()) : (doc.status === AppLoanDocumentStatus.SUBMITTED ? new Date() : null),
              updatedAt: new Date(),
            },
          });
        }
      }
      const clientProvidedCurrentStageId = dataToUpdate.currentStageId;
      if (clientProvidedCurrentStageId && clientProvidedCurrentStageId !== existingLoan.currentStageIdMirror) {
        const wfDefId = dataToUpdate.workflowDefinitionId || existingLoan.workflowDefinitionIdMirror;
        const wfVerId = dataToUpdate.workflowVersionId || existingLoan.workflowVersionIdMirror;

        if (!wfDefId || !wfVerId) {
          throw new Error("Workflow context (DefinitionId or VersionId) missing for stage transition.");
        }

        const newStageDef = await tx.workflowStageDefinition.findUnique({
          where: { id: clientProvidedCurrentStageId, workflowVersionId: wfVerId },
          include: { responsibleDepartment: true }
        });

        if (!newStageDef || !newStageDef.responsibleDepartment) {
          throw new Error(`New stage definition (or its department) not found for ID "${clientProvidedCurrentStageId}" in version "${wfVerId}".`);
        }

        updatePayload.currentWorkflowStage = { connect: { id: newStageDef.id } };
        // These are not in prisma schema
        // updatePayload.workflowDefinitionIdMirror = wfDefId;
        // updatePayload.workflowVersionIdMirror = wfVerId;
        // updatePayload.currentStageIdMirror = newStageDef.id;
        updatePayload.stageEntryDate = new Date();
        const newStageDeadline = addDays(new Date(), newStageDef.defaultTimelineDays);
        updatePayload.stageDeadline = newStageDeadline;
        updatePayload.isReadyForManagerReview = false;
        const initialStatus = newStageDef.availableStatuses && newStageDef.availableStatuses.length > 0 ? newStageDef.availableStatuses[0] : 'Initiated';
        updatePayload.currentStageStatus = initialStatus;
        const isTerminal = newStageDef.name.toLowerCase().includes("closed") ||
                           newStageDef.name.toLowerCase().includes("rejected") ||
                           newStageDef.name.toLowerCase().includes("disbursed") ||
                           newStageDef.name.toLowerCase().includes("funded");
        updatePayload.isTerminalStage = isTerminal;
        updatePayload.isOverdue = isBefore(newStageDeadline, new Date()) && !isTerminal;
        if (!dataToUpdate.hasOwnProperty('assignedTo')) {
            updatePayload.assignedToUser = { disconnect: true };
        }
      } else {
        const currentStageForStatus = existingLoan.currentWorkflowStage;
        if (currentStageForStatus) {
          updatePayload.isTerminalStage = dataToUpdate.isTerminalStage !== undefined ? dataToUpdate.isTerminalStage : (
            currentStageForStatus.name.toLowerCase().includes("closed") ||
            currentStageForStatus.name.toLowerCase().includes("rejected") ||
            currentStageForStatus.name.toLowerCase().includes("disbursed") ||
            currentStageForStatus.name.toLowerCase().includes("funded")
          );
          const deadlineToUse = dataToUpdate.stageDeadline ? parseISO(dataToUpdate.stageDeadline) : (existingLoan.stageDeadline);
          if (deadlineToUse && isValid(new Date(deadlineToUse))) {
            updatePayload.isOverdue = isBefore(new Date(deadlineToUse), new Date()) && !updatePayload.isTerminalStage;
          } else if (!deadlineToUse) {
            updatePayload.isOverdue = false;
          }
        }
      }
      if (dataToUpdate.stageDeadline && typeof dataToUpdate.stageDeadline === 'string' && isValid(parseISO(dataToUpdate.stageDeadline))) {
        updatePayload.stageDeadline = parseISO(dataToUpdate.stageDeadline);
      }

      return tx.loanRequest.update({
        where: { id },
        data: updatePayload,
        include: {
          assignedToUser: { include: { department: true, customRole: true } },
          currentWorkflowStage: { include: { responsibleDepartment: true } },
          workflowVersion: { include: { workflowDefinition: true } },
          history: { include: { user: { include: { customRole: true } } }, orderBy: { timestamp: 'desc' } },
          documents: { orderBy: { createdAt: 'asc' } },
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
      orderBy: { loanType: 'asc' },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            stages: {
              orderBy: { order: 'asc' },
              include: { responsibleDepartment: true }
            },
          },
        },
      },
    });

    const appWorkflowDefs: WorkflowDefinition[] = prismaWorkflowDefs.map(def => ({
      id: def.id,
      name: def.name,
      loanType: def.loanType,
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
          requiredDocumentNames: s.requiredDocumentNames,
          percentageWeight: s.percentageWeight,
          order: s.order,
          availableStatuses: s.availableStatuses,
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
  definitionData: Omit<WorkflowDefinition, 'id' | 'versions' | 'createdAt' | 'updatedAt'>
): Promise<{ id?: string; error?: string }> {
  try {
    const existing = await prisma.workflowDefinition.findUnique({
      where: { loanType: definitionData.loanType.trim() },
    });
    if (existing) {
      return createErrorResult(`Workflow definition for loan type "${definitionData.loanType}" already exists.`, "addWorkflowDefinition");
    }

    const newDef = await prisma.workflowDefinition.create({
      data: {
        name: definitionData.name,
        loanType: definitionData.loanType.trim(),
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
            loanType: defData.loanType,
            description: defData.description,
          },
          update: {
            name: defData.name,
            loanType: defData.loanType,
            description: defData.description,
            updatedAt: new Date(),
          },
        });
        const definitionId = upsertedDef.id;

        const existingDbVersionIds = (await tx.workflowVersion.findMany({
            where: { workflowDefinitionId: definitionId },
            select: { id: true }
        })).map(v => v.id);

        const uiVersionIds = new Set(versions.map(v => v.id).filter(id => id));

        const versionsToDelete = existingDbVersionIds.filter(id => !uiVersionIds.has(id));
        if (versionsToDelete.length > 0) {
            await tx.workflowStageDefinition.deleteMany({ where: { workflowVersion: { id: { in: versionsToDelete } } } });
            await tx.workflowVersion.deleteMany({ where: { id: { in: versionsToDelete }}});
        }

        for (const version of versions) {
          const { stages, ...versionData } = version;
          const upsertedVersion = await tx.workflowVersion.upsert({
            where: { id: version.id || `_non_existent_ver_id_${Date.now()}` },
            create: {
              id: version.id || undefined,
              workflowDefinition: { connect: { id: definitionId } },
              versionNumber: versionData.versionNumber,
              isActive: versionData.isActive,
            },
            update: {
              versionNumber: versionData.versionNumber,
              isActive: versionData.isActive,
              updatedAt: new Date(),
            },
          });
          const versionId = upsertedVersion.id;

          const existingDbStageIds = (await tx.workflowStageDefinition.findMany({
              where: { workflowVersionId: versionId },
              select: { id: true }
          })).map(s => s.id);
          const uiStageIds = new Set(stages.map(s => s.id).filter(id => id));

          const stagesToDelete = existingDbStageIds.filter(id => !uiStageIds.has(id));
          if (stagesToDelete.length > 0) {
            await tx.workflowStageDefinition.deleteMany({ where: { id: { in: stagesToDelete }}});
          }

          for (const stage of stages) {
             const department = await tx.department.findUnique({ where: {nameLowercase: stage.responsibleDepartment.toLowerCase() }});
             if (!department) throw new Error(`Department "${stage.responsibleDepartment}" not found for stage "${stage.name}". Please create department first.`);

            await tx.workflowStageDefinition.upsert({
              where: { id: stage.id || `_non_existent_stage_id_${Date.now()}` },
              create: {
                id: stage.id || undefined,
                workflowVersion: { connect: { id: versionId } },
                name: stage.name,
                responsibleDepartment: { connect: { id: department.id } },
                defaultTimelineDays: stage.defaultTimelineDays,
                requiredDocumentNames: stage.requiredDocumentNames,
                percentageWeight: stage.percentageWeight,
                order: stage.order,
                availableStatuses: stage.availableStatuses,
              },
              update: {
                name: stage.name,
                responsibleDepartment: { connect: { id: department.id } },
                defaultTimelineDays: stage.defaultTimelineDays,
                requiredDocumentNames: stage.requiredDocumentNames,
                percentageWeight: stage.percentageWeight,
                order: stage.order,
                availableStatuses: stage.availableStatuses,
                updatedAt: new Date(),
              },
            });
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
    const existing = await prisma.department.findUnique({
      where: { nameLowercase: nameLower },
    });
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
    const stagesUsingDept = await prisma.workflowStageDefinition.count({
        where: { responsibleDepartment: { id: departmentId } }
    });
    if (stagesUsingDept > 0) {
        return createErrorResult(`Cannot delete department. It is currently assigned to ${stagesUsingDept} workflow stage(s). Please reassign stages before deleting.`, "deleteDepartment_inUseStages");
    }
     const usersInDept = await prisma.user.count({
        where: { departmentId: departmentId }
    });
     if (usersInDept > 0) {
        return createErrorResult(`Cannot delete department. It is currently assigned to ${usersInDept} user(s). Please reassign users before deleting.`, "deleteDepartment_inUseUsers");
    }

    await prisma.department.delete({
      where: { id: departmentId },
    });
    return { success: true };
  } catch (e: any) {
    if ((e as any).code === 'P2003' || (e as any).message?.includes("foreign key constraint")) {
      return createErrorResult(`Cannot delete department. It is referenced by existing data (e.g., old workflow stages not updated). Please ensure no records link to this department before deleting.`, "deleteDepartment_constraint", e);
    }
    return createErrorResult(`Failed to delete department ID: ${departmentId}.`, "deleteDepartment", e);
  }
}

export async function getAvailableLoanTypesForWorkflow(): Promise<{ loanTypes?: string[]; error?: string }> {
  try {
    const activeDefinitions = await prisma.workflowDefinition.findMany({
      where: {
        versions: {
          some: {
            isActive: true,
            stages: { some: {} }, // Ensure the active version has at least one stage
          },
        },
      },
      select: {
        loanType: true,
      },
      orderBy: {
        loanType: 'asc'
      }
    });

    const loanTypes = Array.from(new Set(activeDefinitions.map(v => v.loanType)));
    return { loanTypes };
  } catch (e: any) {
    return createErrorResult("Failed to fetch available loan types for workflow.", "getAvailableLoanTypesForWorkflow", e);
  }
}
