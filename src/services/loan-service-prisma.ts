
'use server';
import prisma from '@/lib/prisma';
import type {
  LoanRequest as PrismaLoanRequest,
  WorkflowDefinition as PrismaWorkflowDefinition,
  WorkflowVersion as PrismaWorkflowVersion,
  // Prisma uses the model name directly for the type, so it's PrismaWorkflowStageDefinition
  WorkflowStageDefinition as PrismaWorkflowStageDefinitionModel,
  Department as PrismaDepartment,
  User as PrismaUser,
  LoanDocument as PrismaLoanDocument,
  LoanHistoryEntry as PrismaLoanHistoryEntry,
  LoanDocumentStatus as PrismaLoanDocumentStatus,
  UserRole as PrismaUserRole,
} from '@prisma/client';

import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, LoanDocument, LoanHistoryEntry } from '@/types/loan';
import { UserRole as AppUserRole, LoanDocumentStatus as AppLoanDocumentStatus } from '@/types/loan';

import { mockUsers } from '@/lib/mock-data';
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

const mapPrismaLoanToAppLoan = (
    prismaLoan: PrismaLoanRequest & {
        assignedToUser?: PrismaUser | null;
        currentWorkflowStage?: (PrismaWorkflowStageDefinitionModel & { responsibleDepartment: PrismaDepartment }) | null;
        workflowVersion?: (PrismaWorkflowVersion & { workflowDefinition: PrismaWorkflowDefinition }) | null;
        history?: PrismaLoanHistoryEntry[];
        documents?: PrismaLoanDocument[];
    }
): LoanRequest => {

  const isTerminal = prismaLoan.isTerminalStage;
  const isOverdueCalc = prismaLoan.stageDeadline ? isBefore(new Date(prismaLoan.stageDeadline), new Date()) && !isTerminal : false;

  return {
    id: prismaLoan.id,
    loanNumber: prismaLoan.loanNumber,
    customerNumber: prismaLoan.customerNumber,
    customerName: prismaLoan.customerName,
    customerEmail: prismaLoan.customerEmail,
    customerPhone: prismaLoan.customerPhone,
    customerBranch: prismaLoan.customerBranch || undefined,
    loanAmount: prismaLoan.loanAmount.toNumber(), // Convert Decimal to number
    loanType: prismaLoan.loanType,
    loanPurpose: prismaLoan.loanPurpose,

    workflowDefinitionId: prismaLoan.workflowVersion?.workflowDefinitionId || prismaLoan.workflowDefinitionIdMirror || '',
    workflowVersionId: prismaLoan.workflowVersion?.id || prismaLoan.workflowVersionIdMirror || '',
    currentStageId: prismaLoan.currentWorkflowStage?.id || prismaLoan.currentStageIdMirror || '',

    currentStageName: prismaLoan.currentWorkflowStage?.name || 'Unknown Stage',
    assignedDepartment: prismaLoan.currentWorkflowStage?.responsibleDepartment?.name || 'N/A',

    assignedTo: prismaLoan.assignedToUserId || undefined,
    submittedDate: formatISO(new Date(prismaLoan.submittedDate)),
    lastUpdatedDate: formatISO(new Date(prismaLoan.lastUpdatedDate)),
    stageDeadline: prismaLoan.stageDeadline ? formatISO(new Date(prismaLoan.stageDeadline)) : undefined,
    isReadyForManagerReview: prismaLoan.isReadyForManagerReview,
    isOverdue: isOverdueCalc,
    isTerminalStage: isTerminal,
    history: prismaLoan.history?.map((h: PrismaLoanHistoryEntry) => ({
      ...h,
      timestamp: formatISO(new Date(h.timestamp)),
      userId: h.userId, // userId is already a string from Prisma
    })) || [],
    documents: prismaLoan.documents?.map((d: PrismaLoanDocument) => ({
      ...d,
      status: d.status as AppLoanDocumentStatus, // Cast Prisma enum to App enum
      uploadedAt: d.uploadedAt ? formatISO(new Date(d.uploadedAt)) : undefined,
      createdAt: d.createdAt ? formatISO(new Date(d.createdAt)) : undefined,
      updatedAt: d.updatedAt ? formatISO(new Date(d.updatedAt)) : undefined,
    })) || [],
    createdAt: formatISO(new Date(prismaLoan.createdAt)),
    updatedAt: formatISO(new Date(prismaLoan.updatedAt)),
  };
};


export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline' | 'assignedTo' | 'isReadyForManagerReview' | 'workflowDefinitionId' | 'workflowVersionId' | 'currentStageId' | 'assignedDepartment' | 'currentStageName' | 'isTerminalStage' | 'createdAt' | 'updatedAt'>
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
      return createErrorResult(`No active workflow version with stages and responsible department found for loan type "${loanData.loanType}". Ensure an active version with stages (and departments) is configured.`, "addLoanRequest");
    }

    const firstStage = activeWorkflowVersion.stages[0];
    const currentDate = new Date();
    const stageDeadlineDate = addDays(currentDate, firstStage.defaultTimelineDays);

    const initialAssigneeFromMock = mockUsers.find(u => u.department === firstStage.responsibleDepartment.name && u.role === AppUserRole.RELATIONSHIP_MANAGER)
                         || mockUsers.find(u => u.department === firstStage.responsibleDepartment.name);

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

        workflowVersionId: activeWorkflowVersion.id, // FK to WorkflowVersion
        currentStageId: firstStage.id,           // FK to WorkflowStageDefinition

        submittedDate: currentDate,
        lastUpdatedDate: currentDate,
        stageEntryDate: currentDate,
        stageDeadline: stageDeadlineDate,
        isReadyForManagerReview: false,
        isOverdue: false,
        isTerminalStage: false,

        assignedToUserId: initialAssigneeFromMock?.id || null,

        history: {
          create: [{
            userId: initialAssigneeFromMock?.id || 'system-prisma-placeholder', // This user ID should exist in your User table or be a placeholder
            userName: initialAssigneeFromMock?.name || 'LoanFlow System',
            stageName: firstStage.name,
            timestamp: currentDate,
            notes: `Loan application submitted. Workflow: ${activeWorkflowVersion.workflowDefinition.name} (V${activeWorkflowVersion.versionNumber}). Initial stage: ${firstStage.name}. Assigned to ${initialAssigneeFromMock?.name || 'Unassigned Staff'} in ${firstStage.responsibleDepartment.name}. Branch: ${loanData.customerBranch || 'N/A'}.`,
          }],
        },
      },
    });
    return { id: newLoan.id };
  } catch (e: any) {
    return createErrorResult("Failed to add loan request.", "addLoanRequest", e);
  }
}

export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string; users?: User[] }> {
  try {
    const prismaLoans = await prisma.loanRequest.findMany({
      orderBy: { lastUpdatedDate: 'desc' },
      include: {
        assignedToUser: true, // Include the related User record for assignee
        currentWorkflowStage: { include: { responsibleDepartment: true } }, // Include current stage and its department
        workflowVersion: { include: { workflowDefinition: true } }, // Include version and its parent definition
        history: { orderBy: { timestamp: 'desc' } },
        documents: { orderBy: { createdAt: 'asc' } },
      },
    });

    const appLoans = prismaLoans.map(pl => mapPrismaLoanToAppLoan(pl as any)); // Cast needed due to complex include
    const appUsers = mockUsers.map(u => ({ ...u, department: u.department as Department | undefined })); // Ensure department type matches

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
        assignedToUser: true,
        currentWorkflowStage: { include: { responsibleDepartment: true } },
        workflowVersion: {
          include: {
            workflowDefinition: true,
            stages: { orderBy: { order: 'asc' }, include: {responsibleDepartment: true} },
          },
        },
        history: { orderBy: { timestamp: 'desc' } },
        documents: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!prismaLoan) {
      return { loan: null, users: mockUsers, error: `Loan with ID "${id}" not found.` };
    }

    const appLoan = mapPrismaLoanToAppLoan(prismaLoan as any); // Cast for complex include
    const appUsers = mockUsers.map(u => ({ ...u, department: u.department as Department | undefined }));
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
        include: { currentWorkflowStage: true } // Fetch current stage for logic
      });

      if (!existingLoan) {
        throw new Error(`Loan with ID "${id}" not found for update.`);
      }

      const updatePayload: any = {
        lastUpdatedDate: new Date(), // Always update this
      };

      // Direct field updates
      const simpleFields: (keyof Pick<LoanRequest, 'customerName' | 'customerEmail' | 'customerPhone' | 'loanType' | 'loanPurpose' | 'isReadyForManagerReview' | 'customerBranch' >)[] =
        ['customerName', 'customerEmail', 'customerPhone', 'loanType', 'loanPurpose', 'isReadyForManagerReview', 'customerBranch'];
      simpleFields.forEach(field => {
        if (dataToUpdate[field] !== undefined) { // Allows setting to null if field is optional
          updatePayload[field] = dataToUpdate[field];
        }
      });
      if (dataToUpdate.loanAmount !== undefined && dataToUpdate.loanAmount !== null) {
        updatePayload.loanAmount = dataToUpdate.loanAmount;
      }

      // Handle assignedTo (maps to assignedToUserId)
      if (dataToUpdate.hasOwnProperty('assignedTo')) { // Check if key exists, even if value is undefined/null
        updatePayload.assignedToUserId = dataToUpdate.assignedTo || null;
      }

      // Handle History: Upsert logic or create new entries
      if (dataToUpdate.history && dataToUpdate.history.length > 0) {
        const existingHistoryIds = new Set((await tx.loanHistoryEntry.findMany({ where: { loanRequestId: id }, select: { id: true }})).map(h => h.id));
        const historyCreates: any[] = [];
        const historyUpdates: {id: string, data: any}[] = [];

        for (const entry of dataToUpdate.history) {
            const userForHistory = mockUsers.find(u => u.id === entry.userId);
            const historyEntryData = {
                userId: entry.userId,
                userName: userForHistory?.name || entry.userName || 'System',
                stageName: entry.stageName,
                timestamp: isValid(parseISO(entry.timestamp)) ? parseISO(entry.timestamp) : new Date(),
                notes: entry.notes,
                requiredFulfilment: entry.requiredFulfilment,
            };
            if(entry.id && existingHistoryIds.has(entry.id)) {
                historyUpdates.push({id: entry.id, data: {notes: entry.notes, requiredFulfilment: entry.requiredFulfilment, updatedAt: new Date()}});
            } else {
                historyCreates.push({id: entry.id || undefined, ...historyEntryData, loanRequestId: id});
            }
        }
        if (historyCreates.length > 0) {
            await tx.loanHistoryEntry.createMany({ data: historyCreates, skipDuplicates: true });
        }
        for(const update of historyUpdates) {
            await tx.loanHistoryEntry.update({where: {id: update.id}, data: update.data});
        }
      }


      // Handle Documents: Upsert logic
      if (dataToUpdate.documents && dataToUpdate.documents.length > 0) {
        for (const doc of dataToUpdate.documents) {
          await tx.loanDocument.upsert({
            where: { id: doc.id || `_non_existent_doc_id_for_loan_${id}_${Date.now()}` },
            create: {
              id: doc.id || undefined,
              loanRequestId: id,
              name: doc.name,
              status: doc.status as PrismaLoanDocumentStatus,
              notes: doc.notes,
              uploadedAt: doc.uploadedAt ? (isValid(parseISO(doc.uploadedAt)) ? parseISO(doc.uploadedAt) : new Date()) : null,
            },
            update: {
              name: doc.name,
              status: doc.status as PrismaLoanDocumentStatus,
              notes: doc.notes,
              uploadedAt: doc.uploadedAt ? (isValid(parseISO(doc.uploadedAt)) ? parseISO(doc.uploadedAt) : new Date()) : (doc.status === "SUBMITTED" ? new Date() : null),
              updatedAt: new Date(),
            },
          });
        }
      }
      // Stage transition logic
      const clientProvidedCurrentStageId = dataToUpdate.currentStageId;
      if (clientProvidedCurrentStageId && clientProvidedCurrentStageId !== existingLoan.currentStageIdMirror) {
        const wfDefId = dataToUpdate.workflowDefinitionId || existingLoan.workflowDefinitionIdMirror;
        const wfVerId = dataToUpdate.workflowVersionId || existingLoan.workflowVersionIdMirror;

        if (!wfDefId || !wfVerId) {
          throw new Error("Workflow context (DefinitionId or VersionId) missing for stage transition.");
        }

        const newStageDef = await tx.workflowStageDefinition.findUnique({
          where: { id: clientProvidedCurrentStageId, workflowVersionId: wfVerId }, // Ensure stage belongs to the version
        });

        if (!newStageDef) {
          throw new Error(`New stage definition not found for ID "${clientProvidedCurrentStageId}" in version "${wfVerId}".`);
        }

        updatePayload.currentStageId = newStageDef.id; // FK
        updatePayload.workflowVersionId = wfVerId; // FK

        updatePayload.workflowDefinitionIdMirror = wfDefId;
        updatePayload.workflowVersionIdMirror = wfVerId;
        updatePayload.currentStageIdMirror = newStageDef.id;

        updatePayload.stageEntryDate = new Date();
        updatePayload.stageDeadline = addDays(new Date(), newStageDef.defaultTimelineDays);
        updatePayload.isReadyForManagerReview = false; // Reset on stage change

        const isTerminal = newStageDef.name.toLowerCase().includes("closed") ||
                           newStageDef.name.toLowerCase().includes("rejected") ||
                           newStageDef.name.toLowerCase().includes("disbursed") ||
                           newStageDef.name.toLowerCase().includes("funded");
        updatePayload.isTerminalStage = isTerminal;
        updatePayload.isOverdue = isBefore(new Date(updatePayload.stageDeadline), new Date()) && !isTerminal;

        // If assignedTo was not explicitly part of dataToUpdate for stage change, unassign
        if (!dataToUpdate.hasOwnProperty('assignedTo')) {
          updatePayload.assignedToUserId = null;
        }

      } else { // No stage change, but other fields might affect overdue/terminal status
        const currentStageForStatus = existingLoan.currentWorkflowStage || await tx.workflowStageDefinition.findUnique({ where: { id: existingLoan.currentStageId } });
        if (currentStageForStatus) {
          updatePayload.isTerminalStage = dataToUpdate.isTerminalStage !== undefined ? dataToUpdate.isTerminalStage : (
            currentStageForStatus.name.toLowerCase().includes("closed") ||
            currentStageForStatus.name.toLowerCase().includes("rejected") ||
            currentStageForStatus.name.toLowerCase().includes("disbursed") ||
            currentStageForStatus.name.toLowerCase().includes("funded")
          );

          const deadlineToUse = dataToUpdate.stageDeadline ? parseISO(dataToUpdate.stageDeadline) : (existingLoan.stageDeadline);
          if (deadlineToUse && isValid(deadlineToUse)) {
            updatePayload.isOverdue = isBefore(new Date(deadlineToUse), new Date()) && !updatePayload.isTerminalStage;
          } else if (!deadlineToUse){ // If no deadline, not overdue
            updatePayload.isOverdue = false;
          }
          // If deadlineToUse is invalid, isOverdue remains unchanged or defaults from schema
        }
      }
      if (dataToUpdate.stageDeadline && typeof dataToUpdate.stageDeadline === 'string' && isValid(parseISO(dataToUpdate.stageDeadline))) {
        updatePayload.stageDeadline = parseISO(dataToUpdate.stageDeadline);
      }


      return tx.loanRequest.update({
        where: { id },
        data: updatePayload,
        include: {
          assignedToUser: true,
          currentWorkflowStage: { include: { responsibleDepartment: true } },
          workflowVersion: { include: { workflowDefinition: true } },
          history: { orderBy: { timestamp: 'desc' } },
          documents: { orderBy: { createdAt: 'asc' } },
        },
      });
    });

    const appLoan = mapPrismaLoanToAppLoan(updatedPrismaLoan as any); // Cast for complex include
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
      createdAt: def.createdAt? formatISO(new Date(def.createdAt)): undefined,
      updatedAt: def.updatedAt? formatISO(new Date(def.updatedAt)): undefined,
      versions: def.versions.map(v => ({
        id: v.id,
        workflowDefinitionId: v.workflowDefinitionId,
        versionNumber: v.versionNumber,
        isActive: v.isActive,
        createdAt: v.createdAt? formatISO(new Date(v.createdAt)): '', // Ensure not undefined
        updatedAt: v.updatedAt ? formatISO(new Date(v.updatedAt)) : undefined,
        stages: v.stages.map(s => ({
          id: s.id,
          name: s.name,
          responsibleDepartment: s.responsibleDepartment.name, // Map Department object to name string
          defaultTimelineDays: s.defaultTimelineDays,
          requiredDocumentNames: s.requiredDocumentNames,
          percentageWeight: s.percentageWeight,
          order: s.order,
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

export async function addWorkflowDefinition( // Renamed for Prisma context
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
        // createdAt and updatedAt default in schema
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

        const uiVersionIds = new Set(versions.map(v => v.id).filter(id => id)); // Filter out undefined IDs

        // Delete versions not present in UI
        const versionsToDelete = existingDbVersionIds.filter(id => !uiVersionIds.has(id));
        if (versionsToDelete.length > 0) {
            // Prisma's onDelete: Cascade on WorkflowVersion should handle stages
            await tx.workflowVersion.deleteMany({ where: { id: { in: versionsToDelete }}});
        }

        for (const version of versions) {
          const { stages, ...versionData } = version;
          const upsertedVersion = await tx.workflowVersion.upsert({
            where: { id: version.id || `_non_existent_ver_id_${Date.now()}` },
            create: {
              id: version.id || undefined,
              workflowDefinitionId: definitionId,
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

          // Delete stages not present in UI
          const stagesToDelete = existingDbStageIds.filter(id => !uiStageIds.has(id));
          if (stagesToDelete.length > 0) {
            await tx.workflowStageDefinition.deleteMany({ where: { id: { in: stagesToDelete }}});
          }

          for (const stage of stages) {
             const department = await tx.department.findUnique({ where: {name: stage.responsibleDepartment }});
             if (!department) throw new Error(`Department "${stage.responsibleDepartment}" not found for stage "${stage.name}". Please create department first.`);

            await tx.workflowStageDefinition.upsert({
              where: { id: stage.id || `_non_existent_stage_id_${Date.now()}` },
              create: {
                id: stage.id || undefined,
                workflowVersionId: versionId,
                name: stage.name,
                responsibleDepartmentId: department.id, // Use department ID for FK
                defaultTimelineDays: stage.defaultTimelineDays,
                requiredDocumentNames: stage.requiredDocumentNames,
                percentageWeight: stage.percentageWeight,
                order: stage.order,
              },
              update: {
                name: stage.name,
                responsibleDepartmentId: department.id,
                defaultTimelineDays: stage.defaultTimelineDays,
                requiredDocumentNames: stage.requiredDocumentNames,
                percentageWeight: stage.percentageWeight,
                order: stage.order,
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
    // Ensure the 'name' type matches the Department type from types/loan.ts
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
      where: { nameLowercase: nameLower }, // Check against the lowercase unique field
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
    // Check if any WorkflowStageDefinition references this department
    const stagesUsingDept = await prisma.workflowStageDefinition.count({
        where: { responsibleDepartmentId: departmentId }
    });
    if (stagesUsingDept > 0) {
        return createErrorResult(`Cannot delete department. It is currently assigned to ${stagesUsingDept} workflow stage(s). Please reassign stages before deleting.`, "deleteDepartment_inUseStages");
    }
    // Check if any User references this department
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
    if ((e as any).code === 'P2003' || (e as any).message?.includes("foreign key constraint")) { // More robust check for FK constraint
      return createErrorResult(`Cannot delete department. It is referenced by existing data. Please ensure no records link to this department before deleting.`, "deleteDepartment_constraint", e);
    }
    return createErrorResult(`Failed to delete department ID: ${departmentId}.`, "deleteDepartment", e);
  }
}

export async function getAvailableLoanTypesForWorkflow(): Promise<{ loanTypes?: string[]; error?: string }> {
  try {
    // Find WorkflowDefinitions that have at least one active version, and that active version has at least one stage
    const activeDefinitions = await prisma.workflowDefinition.findMany({
      where: {
        versions: {
          some: {
            isActive: true,
            stages: { some: {} }, // Check if the stages relation has at least one record
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

