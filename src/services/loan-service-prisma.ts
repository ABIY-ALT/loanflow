
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
  LoanDocumentStatus,
  UserRole,
} from '@prisma/client';

// Assuming types from src/types/loan.ts are still relevant for function signatures and UI contracts,
// but Prisma types will be used internally for database interactions.
// We will need to map between these if they diverge significantly.
// For now, let's assume they are reasonably compatible or the UI will adapt.
import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, LoanDocument, LoanHistoryEntry } from '@/types/loan';

import { mockUsers } from '@/lib/mock-data'; // Kept for now for userName lookup if User table isn't fully populated
import { formatISO, parseISO, addDays, isBefore } from 'date-fns';

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Prisma Loan Service Error (Context: ${context || 'Unknown'}): ${message}.`;
  if (originalError) {
    const errorDetails = (typeof originalError === 'object' && originalError !== null && typeof originalError.message === 'string') ? originalError.message : String(originalError);
    detailedMessage += ` Raw: ${errorDetails}`;
  }
  console.error(`[PrismaService:${context || 'Unknown'}] Error:`, detailedMessage, originalError);
  return { error: detailedMessage };
};

// Helper to map Prisma User to our application's User type
const mapPrismaUserToAppUser = (prismaUser: PrismaUser | null | undefined): User | undefined => {
  if (!prismaUser) return undefined;
  return {
    id: prismaUser.id,
    name: prismaUser.name,
    email: prismaUser.email,
    role: prismaUser.role as UserRole, // Assuming UserRole enum values match
    department: prismaUser.departmentName || undefined,
  };
};


const mapPrismaLoanToAppLoan = (prismaLoan: any): LoanRequest => {
  const currentStage = prismaLoan.currentWorkflowStage;
  const isTerminal = currentStage ? (
    currentStage.name.toLowerCase().includes("closed") ||
    currentStage.name.toLowerCase().includes("rejected") ||
    currentStage.name.toLowerCase().includes("disbursed") ||
    currentStage.name.toLowerCase().includes("funded")
  ) : false;

  const isOverdue = prismaLoan.stageDeadline ? isBefore(new Date(prismaLoan.stageDeadline), new Date()) && !isTerminal : false;

  return {
    id: prismaLoan.id,
    loanNumber: prismaLoan.loanNumber,
    customerNumber: prismaLoan.customerNumber,
    customerName: prismaLoan.customerName,
    customerEmail: prismaLoan.customerEmail,
    customerPhone: prismaLoan.customerPhone,
    customerBranch: prismaLoan.customerBranch || undefined,
    loanAmount: prismaLoan.loanAmount.toNumber(), // Decimal to number
    loanType: prismaLoan.loanType,
    loanPurpose: prismaLoan.loanPurpose,
    workflowDefinitionId: prismaLoan.workflowVersion?.workflowDefinitionId || prismaLoan.workflowDefinitionIdMirror || '',
    workflowVersionId: prismaLoan.workflowVersionId || '',
    currentStageId: prismaLoan.currentStageId || '',
    currentStageName: currentStage?.name || 'Unknown Stage',
    assignedDepartment: currentStage?.responsibleDepartmentName || 'N/A',
    assignedTo: prismaLoan.assignedToUserId || undefined,
    submittedDate: formatISO(new Date(prismaLoan.submittedDate)),
    lastUpdatedDate: formatISO(new Date(prismaLoan.lastUpdatedDate)),
    stageDeadline: prismaLoan.stageDeadline ? formatISO(new Date(prismaLoan.stageDeadline)) : undefined,
    isReadyForManagerReview: prismaLoan.isReadyForManagerReview,
    isOverdue,
    isTerminalStage,
    history: prismaLoan.history?.map((h: any) => ({
      ...h,
      timestamp: formatISO(new Date(h.timestamp)),
    })) || [],
    documents: prismaLoan.documents?.map((d: any) => ({
      ...d,
      uploadedAt: d.uploadedAt ? formatISO(new Date(d.uploadedAt)) : undefined,
    })) || [],
    // Prisma specific fields are not directly mapped to the app type unless needed
  };
};


export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline' | 'assignedTo' | 'isReadyForManagerReview' | 'workflowDefinitionId' | 'workflowVersionId' | 'currentStageId' | 'assignedDepartment' | 'currentStageName' | 'isTerminalStage'>
): Promise<{ id?: string; error?: string }> {
  try {
    const activeWorkflowVersion = await prisma.workflowVersion.findFirst({
      where: {
        workflowDefinition: {
          loanType: loanData.loanType,
        },
        isActive: true,
        stages: { some: {} } // Ensures the active version has at least one stage
      },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          take: 1, // Get only the first stage
        },
        workflowDefinition: true, // To get definition name/id
      },
    });

    if (!activeWorkflowVersion || !activeWorkflowVersion.stages || activeWorkflowVersion.stages.length === 0 || !activeWorkflowVersion.workflowDefinition) {
      return createErrorResult(`No active workflow version with stages found for loan type "${loanData.loanType}". Ensure an active version with stages is configured.`, "addLoanRequest");
    }

    const firstStage = activeWorkflowVersion.stages[0];
    const currentDate = new Date();
    const stageDeadlineDate = addDays(currentDate, firstStage.defaultTimelineDays);

    // Mock user assignment (could be enhanced to pick a specific manager)
    const assignedUser = mockUsers.find(u => u.department === firstStage.responsibleDepartmentName && u.role === UserRole.RELATIONSHIP_MANAGER) || mockUsers.find(u => u.department === firstStage.responsibleDepartmentName);

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

        workflowVersionId: activeWorkflowVersion.id,
        currentStageId: firstStage.id,
        
        submittedDate: currentDate,
        lastUpdatedDate: currentDate,
        stageEntryDate: currentDate,
        stageDeadline: stageDeadlineDate,
        isReadyForManagerReview: false,
        isOverdue: false, // Initial state
        isTerminalStage: false, // Initial state

        assignedToUserId: assignedUser?.id,

        history: {
          create: [{
            userId: assignedUser?.id || 'system-prisma',
            userName: assignedUser?.name || 'LoanFlow System Event',
            stageName: firstStage.name,
            timestamp: currentDate,
            notes: `Loan application submitted. Workflow: ${activeWorkflowVersion.workflowDefinition.name} (V${activeWorkflowVersion.versionNumber}). Initial stage: ${firstStage.name}. Assigned to ${assignedUser?.name || 'Unassigned'} in ${firstStage.responsibleDepartmentName}. Branch: ${loanData.customerBranch || 'N/A'}.`,
          }],
        },
        // documents initially empty
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
        assignedToUser: true,
        currentWorkflowStage: true,
        workflowVersion: {
          include: {
            workflowDefinition: true,
          },
        },
        history: { orderBy: { timestamp: 'desc' } },
        documents: { orderBy: { createdAt: 'asc' } },
      },
    });
    
    const appLoans = prismaLoans.map(mapPrismaLoanToAppLoan);
    const appUsers = mockUsers; // Still using mock users for the general user list for selection dialogs etc.

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
        currentWorkflowStage: true,
        workflowVersion: {
          include: {
            workflowDefinition: true,
            stages: { orderBy: { order: 'asc' } }, // Include all stages of the current version
          },
        },
        history: { orderBy: { timestamp: 'desc' } },
        documents: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!prismaLoan) {
      return { loan: null, users: mockUsers, error: `Loan with ID "${id}" not found.` };
    }
    
    const appLoan = mapPrismaLoanToAppLoan(prismaLoan);
    const appUsers = mockUsers;

    // Fetch all workflow definitions for the detail page (as original service did)
    // This might be optimized if only the current loan's workflow definition is needed.
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
        include: { workflowVersion: true } // Need current workflowVersionId
      });

      if (!existingLoan) {
        throw new Error(`Loan with ID "${id}" not found for update.`);
      }

      const updatePayload: any = {
        lastUpdatedDate: new Date(),
      };

      // Map simple fields
      const simpleFields: (keyof typeof dataToUpdate)[] = ['customerName', 'customerEmail', 'customerPhone', 'loanAmount', 'loanType', 'loanPurpose', 'isReadyForManagerReview'];
      simpleFields.forEach(field => {
        if (dataToUpdate[field] !== undefined) {
          if (field === 'loanAmount' && typeof dataToUpdate.loanAmount === 'number') {
            updatePayload.loanAmount = dataToUpdate.loanAmount;
          } else if (field !== 'loanAmount') {
            updatePayload[field] = dataToUpdate[field];
          }
        }
      });
      
      if (dataToUpdate.customerBranch !== undefined) updatePayload.customerBranch = dataToUpdate.customerBranch;


      // Handle assignedTo (maps to assignedToUserId)
      if (dataToUpdate.hasOwnProperty('assignedTo')) {
        updatePayload.assignedToUserId = dataToUpdate.assignedTo || null;
      }
      
      // Handle history: assuming new history entries are appended
      if (dataToUpdate.history && dataToUpdate.history.length > 0) {
        const newHistoryEntries = dataToUpdate.history.filter(
          h => !existingLoan.history?.some((eh: any) => eh.id === h.id) // Simplistic check, assumes new entries have new IDs
        );
        if (newHistoryEntries.length > 0) {
          updatePayload.history = {
            create: newHistoryEntries.map(h => ({
              id: h.id, // Assuming client generates a unique ID for new history
              userId: h.userId,
              userName: h.userName, // Client should provide this
              stageName: h.stageName,
              timestamp: parseISO(h.timestamp),
              notes: h.notes,
              requiredFulfilment: h.requiredFulfilment,
            })),
          };
        }
        // For existing history entries that might have been updated (e.g. notes for fulfillment)
        const updatedExistingHistory = dataToUpdate.history.filter(h => 
          existingLoan.history?.some((eh: any) => eh.id === h.id && eh.notes !== h.notes)
        );
        if (updatedExistingHistory.length > 0) {
          if (!updatePayload.history) updatePayload.history = {};
          updatePayload.history.updateMany = updatedExistingHistory.map(h => ({
            where: { id: h.id },
            data: { notes: h.notes } 
          }));
        }
      }

      // Handle documents: upsert logic
      if (dataToUpdate.documents && dataToUpdate.documents.length > 0) {
        updatePayload.documents = {
          upsert: dataToUpdate.documents.map(doc => ({
            where: { id: doc.id }, // Assumes client sends existing doc ID or a new one for new docs
            create: {
              id: doc.id,
              name: doc.name,
              status: doc.status as LoanDocumentStatus,
              notes: doc.notes,
              uploadedAt: doc.uploadedAt ? parseISO(doc.uploadedAt) : null,
            },
            update: {
              status: doc.status as LoanDocumentStatus,
              notes: doc.notes,
              uploadedAt: doc.uploadedAt ? parseISO(doc.uploadedAt) : (doc.status === "Submitted" ? new Date() : undefined), // Update uploadedAt on new submission
            },
          })),
        };
      }
      
      // Handle stage transition
      const clientProvidedCurrentStageId = dataToUpdate.currentStageId;
      if (clientProvidedCurrentStageId && clientProvidedCurrentStageId !== existingLoan.currentStageIdMirror) {
        const wfDefId = dataToUpdate.workflowDefinitionId || existingLoan.workflowDefinitionIdMirror;
        const wfVerId = dataToUpdate.workflowVersionId || existingLoan.workflowVersionIdMirror;

        if (!wfDefId || !wfVerId) {
          throw new Error("Workflow context (DefinitionId or VersionId) missing for stage transition.");
        }

        const newStageDef = await tx.workflowStageDefinition.findUnique({
          where: { id: clientProvidedCurrentStageId, workflowVersionId: wfVerId },
        });

        if (!newStageDef) {
          throw new Error(`New stage definition not found for ID "${clientProvidedCurrentStageId}" in version "${wfVerId}".`);
        }

        updatePayload.currentStageId = newStageDef.id;
        updatePayload.currentStageIdMirror = newStageDef.id; // Update mirror
        updatePayload.workflowDefinitionIdMirror = wfDefId;
        updatePayload.workflowVersionIdMirror = wfVerId;
        // workflowVersionId is likely already correct or being set if changing versions
        if (dataToUpdate.workflowVersionId && dataToUpdate.workflowVersionId !== existingLoan.workflowVersionId) {
            updatePayload.workflowVersionId = dataToUpdate.workflowVersionId;
        }


        updatePayload.stageEntryDate = new Date();
        updatePayload.stageDeadline = addDays(new Date(), newStageDef.defaultTimelineDays);
        updatePayload.isReadyForManagerReview = false; // Reset on stage change

        // If stage changes, and 'assignedTo' is not explicitly being set in this update, unassign the user.
        if (!dataToUpdate.hasOwnProperty('assignedTo')) {
          updatePayload.assignedToUserId = null;
        }
      }
      
      // Determine isTerminalStage and isOverdue based on potentially new stage
      let finalStageIdToCheck = updatePayload.currentStageId || existingLoan.currentStageId;
      if(finalStageIdToCheck) {
        const stageInfoForOverdue = await tx.workflowStageDefinition.findUnique({ where: {id: finalStageIdToCheck}});
        if(stageInfoForOverdue){
            updatePayload.isTerminalStage = stageInfoForOverdue.name.toLowerCase().includes("closed") ||
                                       stageInfoForOverdue.name.toLowerCase().includes("rejected") ||
                                       stageInfoForOverdue.name.toLowerCase().includes("disbursed") ||
                                       stageInfoForOverdue.name.toLowerCase().includes("funded");
            const deadlineToUse = updatePayload.stageDeadline || existingLoan.stageDeadline;
            if(deadlineToUse) {
                updatePayload.isOverdue = isBefore(new Date(deadlineToUse), new Date()) && !updatePayload.isTerminalStage;
            } else {
                updatePayload.isOverdue = false;
            }
        }
      }


      return tx.loanRequest.update({
        where: { id },
        data: updatePayload,
        include: { // Re-fetch with all includes for consistent return
          assignedToUser: true,
          currentWorkflowStage: true,
          workflowVersion: {
            include: {
              workflowDefinition: true,
            },
          },
          history: { orderBy: { timestamp: 'desc' } },
          documents: { orderBy: { createdAt: 'asc' } },
        },
      });
    });

    const appLoan = mapPrismaLoanToAppLoan(updatedPrismaLoan);
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
      createdAt: def.createdAt ? formatISO(new Date(def.createdAt)) : undefined,
      updatedAt: def.updatedAt ? formatISO(new Date(def.updatedAt)) : undefined,
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
          responsibleDepartment: s.responsibleDepartmentName,
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
        
        // Upsert Definition
        const upsertedDef = await tx.workflowDefinition.upsert({
          where: { id: definition.id || `_non_existent_id_${Date.now()}` }, // Use actual ID if present for update
          create: {
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

        // Manage Versions
        const existingDbVersions = await tx.workflowVersion.findMany({ where: { workflowDefinitionId: definitionId } });
        const uiVersionIds = new Set(versions.map(v => v.id));

        // Delete versions not in UI
        for (const dbVersion of existingDbVersions) {
          if (!uiVersionIds.has(dbVersion.id)) {
            await tx.workflowStageDefinition.deleteMany({ where: { workflowVersionId: dbVersion.id } }); // Delete stages first
            await tx.workflowVersion.delete({ where: { id: dbVersion.id } });
          }
        }
        
        for (const version of versions) {
          const { stages, ...versionData } = version;
          // Upsert Version
          const upsertedVersion = await tx.workflowVersion.upsert({
            where: { id: version.id || `_non_existent_id_ver_${Date.now()}` },
            create: {
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

          // Manage Stages for this version
          const existingDbStages = await tx.workflowStageDefinition.findMany({ where: { workflowVersionId: versionId } });
          const uiStageIds = new Set(stages.map(s => s.id));

          // Delete stages not in UI
          for (const dbStage of existingDbStages) {
            if (!uiStageIds.has(dbStage.id)) {
              await tx.workflowStageDefinition.delete({ where: { id: dbStage.id } });
            }
          }

          for (const stage of stages) {
            // Upsert Stage
            await tx.workflowStageDefinition.upsert({
              where: { id: stage.id || `_non_existent_id_stage_${Date.now()}` },
              create: {
                workflowVersionId: versionId,
                name: stage.name,
                responsibleDepartmentName: stage.responsibleDepartment,
                defaultTimelineDays: stage.defaultTimelineDays,
                requiredDocumentNames: stage.requiredDocumentNames,
                percentageWeight: stage.percentageWeight,
                order: stage.order,
              },
              update: {
                name: stage.name,
                responsibleDepartmentName: stage.responsibleDepartment,
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
    // Check if department is in use by any workflow stage
    const stagesUsingDept = await prisma.workflowStageDefinition.count({
        where: { responsibleDepartment: { id: departmentId } } // Assumes departmentName is FK to Department.name
    });
    if (stagesUsingDept > 0) {
        return createErrorResult(`Cannot delete department. It is currently assigned to ${stagesUsingDept} workflow stage(s). Please reassign stages before deleting.`, "deleteDepartment_inUse");
    }

    await prisma.department.delete({
      where: { id: departmentId },
    });
    return { success: true };
  } catch (e: any) {
     // Prisma's P2003 error code for foreign key constraint failed
    if (e.code === 'P2003' || (e.message && e.message.includes("foreign key constraint fails"))) {
      return createErrorResult(`Cannot delete department. It is referenced by existing workflow stages.`, "deleteDepartment_constraint", e);
    }
    return createErrorResult(`Failed to delete department ID: ${departmentId}.`, "deleteDepartment", e);
  }
}

export async function getAvailableLoanTypesForWorkflow(): Promise<{ loanTypes?: string[]; error?: string }> {
  try {
    const activeVersionsWithStages = await prisma.workflowVersion.findMany({
      where: {
        isActive: true,
        stages: { some: {} }, // Has at least one stage
      },
      select: {
        workflowDefinition: {
          select: {
            loanType: true,
          },
        },
      },
    });

    const loanTypes = Array.from(new Set(activeVersionsWithStages.map(v => v.workflowDefinition.loanType))).sort();
    return { loanTypes };
  } catch (e: any) {
    return createErrorResult("Failed to fetch available loan types for workflow.", "getAvailableLoanTypesForWorkflow", e);
  }
}
    