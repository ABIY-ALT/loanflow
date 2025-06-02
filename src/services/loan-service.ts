
'use server';
import type { LoanRequest, User, LoanHistoryEntry, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
import { UserRole } from '@/types/loan'; // Removed LoanStage as it's less central
import { mockLoanRequests, mockUsers, mockWorkflowDefinitions } from '@/lib/mock-data';
import { formatISO, parseISO, addDays } from 'date-fns';

let sessionMockLoanRequests: LoanRequest[] = JSON.parse(JSON.stringify(mockLoanRequests));
let sessionMockWorkflowDefinitions: WorkflowDefinition[] = JSON.parse(JSON.stringify(mockWorkflowDefinitions)); // For settings page to modify

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Loan Service Mock Error (Context: ${context || 'Unknown'}): ${message}.`;
  if (originalError) {
    detailedMessage += ` Raw: ${ (typeof originalError === 'object' && originalError !== null) ? JSON.stringify(originalError) : String(originalError)}. Name: ${originalError.name}. Message: ${originalError.message}. Code: ${originalError.code}`;
  }
  console.error(`[Mock Service:${context || 'Unknown'}] Error:`, detailedMessage, originalError);
  return { error: detailedMessage };
};

const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get the active workflow and its latest version
const getActiveWorkflowLatestVersion = (): { workflowDef: WorkflowDefinition, latestVersion: WorkflowVersion } | null => {
  const activeDef = sessionMockWorkflowDefinitions.find(def => def.isActive);
  if (!activeDef || activeDef.versions.length === 0) return null;
  const latestVersion = activeDef.versions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
  return { workflowDef: activeDef, latestVersion };
};

export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline' | 'assignedTo' | 'isReadyForManagerReview' | 'workflowDefinitionId' | 'workflowVersionId' | 'currentStageId' | 'assignedDepartment'>
): Promise<{ id?: string; error?: string }> {
  console.log('[Mock Service:addLoanRequest] Called.');
  
  const activeWorkflowInfo = getActiveWorkflowLatestVersion();
  if (!activeWorkflowInfo || activeWorkflowInfo.latestVersion.stages.length === 0) {
    return createErrorResult("No active workflow or active workflow has no stages defined.", "addLoanRequest");
  }
  const { workflowDef, latestVersion } = activeWorkflowInfo;
  const firstStage = latestVersion.stages[0];

  try {
    await simulateDelay(50 + Math.random() * 100);
    const currentDate = new Date();
    const stageDeadlineDate = addDays(currentDate, firstStage.defaultTimelineDays);

    const newLoan: LoanRequest = {
      id: `loan-mock-${Date.now()}`,
      customerName: loanData.customerName,
      customerEmail: loanData.customerEmail,
      customerPhone: loanData.customerPhone,
      loanAmount: loanData.loanAmount,
      loanType: loanData.loanType,
      loanPurpose: loanData.loanPurpose,
      loanNumber: `LN-MOCK-${String(Date.now()).slice(-5)}`,
      customerNumber: `CUST-MOCK-${String(Date.now()).slice(-4)}`,
      
      workflowDefinitionId: workflowDef.id,
      workflowVersionId: latestVersion.id,
      currentStageId: firstStage.id,
      assignedDepartment: firstStage.responsibleDepartment,
      assignedTo: undefined, // Unassigned to a specific user initially

      submittedDate: formatISO(currentDate),
      lastUpdatedDate: formatISO(currentDate),
      stageDeadline: formatISO(stageDeadlineDate),
      
      history: [
        {
          id: `hist-mock-${Date.now()}`,
          stageName: firstStage.name, // Using new stage name
          timestamp: formatISO(currentDate),
          userId: 'mock-system-user',
          userName: 'System/User (Mock)',
          notes: `Loan application submitted. Workflow: ${workflowDef.name} (V${latestVersion.versionNumber}). Initial stage: ${firstStage.name}. Assigned to ${firstStage.responsibleDepartment} department.`,
        },
      ],
      documents: [],
      isOverdue: false,
      isReadyForManagerReview: false,
    };
    
    sessionMockLoanRequests.unshift(newLoan);
    console.log(`[Mock Service:addLoanRequest] Loan added. ID: ${newLoan.id}. Workflow: ${workflowDef.name} V${latestVersion.versionNumber}, Stage: ${firstStage.name}`);
    return { id: newLoan.id };

  } catch (e: any) {
    return createErrorResult(`Failed to add mock loan request.`, "addLoanRequest", e);
  }
}

const getStageById = (versionId: string, stageId: string): WorkflowStageDefinition | undefined => {
    for (const def of sessionMockWorkflowDefinitions) {
        const version = def.versions.find(v => v.id === versionId);
        if (version) {
            return version.stages.find(s => s.id === stageId);
        }
    }
    return undefined;
};


export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string; users?: User[] }> {
  console.log('[Mock Service:getLoanRequests] Called.');
  try {
    await simulateDelay(50 + Math.random() * 100);

    const processedLoans = sessionMockLoanRequests.map(loan => {
      const stageDef = getStageById(loan.workflowVersionId, loan.currentStageId);
      const stageDeadlineDate = loan.stageDeadline ? parseISO(loan.stageDeadline) : null;
      
      // A stage is terminal if it's the last in its workflow version's stage list, or if it's explicitly marked (future enhancement)
      let isTerminalStage = false;
      const workflowVer = sessionMockWorkflowDefinitions.flatMap(wd => wd.versions).find(v => v.id === loan.workflowVersionId);
      if (workflowVer && stageDef) {
          const stageIndex = workflowVer.stages.findIndex(s => s.id === stageDef.id);
          if (stageIndex === workflowVer.stages.length -1) {
              isTerminalStage = true; // Last stage is terminal
          }
      }
      // Or, if stage name matches specific terminal names (less flexible but ok for mock)
      if (stageDef?.name.includes("Closed") || stageDef?.name.includes("Rejected") || stageDef?.name.includes("Disbursed")) {
          isTerminalStage = true;
      }


      const isOverdue = stageDeadlineDate ? stageDeadlineDate.getTime() < new Date().getTime() && !isTerminalStage : false;

      const history = Array.isArray(loan.history) ? loan.history : [];
      const documents = Array.isArray(loan.documents) ? loan.documents : [];

      return { ...loan, isOverdue, history, documents, assignedDepartment: stageDef?.responsibleDepartment || loan.assignedDepartment };
    });
    return { loans: processedLoans, users: mockUsers };
  } catch (e: any) {
    return createErrorResult("Failed to fetch mock loan requests.", "getLoanRequests", e);
  }
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string; workflows?: WorkflowDefinition[] }> {
  try {
    await simulateDelay(50 + Math.random() * 50);
    const foundLoanData = sessionMockLoanRequests.find(l => l.id === id);
     console.log(`[Mock Service:getLoanRequestById] Attempting to find loan with ID: ${id}. Found: ${!!foundLoanData}`);

    if (foundLoanData) {
      const stageDef = getStageById(foundLoanData.workflowVersionId, foundLoanData.currentStageId);
      const stageDeadlineDate = foundLoanData.stageDeadline ? parseISO(foundLoanData.stageDeadline) : null;

      let isTerminalStage = false;
      const workflowVer = sessionMockWorkflowDefinitions.flatMap(wd => wd.versions).find(v => v.id === foundLoanData.workflowVersionId);
      if (workflowVer && stageDef) {
          const stageIndex = workflowVer.stages.findIndex(s => s.id === stageDef.id);
          if (stageIndex === workflowVer.stages.length -1) isTerminalStage = true;
      }
       if (stageDef?.name.includes("Closed") || stageDef?.name.includes("Rejected") || stageDef?.name.includes("Disbursed")) {
          isTerminalStage = true;
      }

      const isOverdue = stageDeadlineDate ? stageDeadlineDate.getTime() < new Date().getTime() && !isTerminalStage : false;

      const history = Array.isArray(foundLoanData.history) ? foundLoanData.history : [];
      const documents = Array.isArray(foundLoanData.documents) ? foundLoanData.documents : [];

      const loan = { ...foundLoanData, isOverdue, history, documents, assignedDepartment: stageDef?.responsibleDepartment || foundLoanData.assignedDepartment };
      return { loan, users: mockUsers, workflows: sessionMockWorkflowDefinitions };
    }
    return { loan: null, users: mockUsers, workflows: sessionMockWorkflowDefinitions, error: `Mock loan with ID "${id}" not found.` };
  } catch (e: any) {
    return createErrorResult(`Failed to fetch mock loan request for ID ${id}.`, `getLoanRequestById-${id}`, e);
  }
}

export async function updateLoanRequest(
  id: string,
  dataToUpdate: Partial<Omit<LoanRequest, 'id'>>
): Promise<{ success?: boolean; updatedLoan?: LoanRequest; error?: string }> {
   try {
    await simulateDelay(50 + Math.random() * 100);
    console.log(`[Mock Service:updateLoanRequest] Attempting to update loan ID: ${id} with data:`, dataToUpdate);
    const loanIndex = sessionMockLoanRequests.findIndex(l => l.id === id);

    if (loanIndex > -1) {
      const originalLoan = sessionMockLoanRequests[loanIndex];
      let currentHistory = originalLoan.history;
      if (!Array.isArray(currentHistory)) currentHistory = [];
      
      let newHistory = dataToUpdate.history ? (Array.isArray(dataToUpdate.history) ? dataToUpdate.history : currentHistory) : currentHistory;

      const updatedLoanData: LoanRequest = {
        ...originalLoan,
        ...dataToUpdate,
        history: newHistory as LoanHistoryEntry[], 
        lastUpdatedDate: formatISO(new Date()),
      };
      
      // If currentStageId changed, update assignedDepartment and stageDeadline
      if (dataToUpdate.currentStageId && dataToUpdate.currentStageId !== originalLoan.currentStageId) {
          const newStageDef = getStageById(updatedLoanData.workflowVersionId, dataToUpdate.currentStageId);
          if (newStageDef) {
              updatedLoanData.assignedDepartment = newStageDef.responsibleDepartment;
              updatedLoanData.assignedTo = undefined; // Unassign user when stage/department changes
              updatedLoanData.stageDeadline = formatISO(addDays(new Date(), newStageDef.defaultTimelineDays));
              updatedLoanData.isReadyForManagerReview = false; // Reset review flag
          }
      }


      sessionMockLoanRequests[loanIndex] = updatedLoanData;
      console.log(`[Mock Service:updateLoanRequest] Successfully updated loan ID: ${id}.`);
      return { success: true, updatedLoan: updatedLoanData };
    }
    return createErrorResult(`Mock loan with ID "${id}" not found for update.`, "updateLoanRequest");
  } catch (e: any) {
    return createErrorResult(`Failed to update mock loan request for ID ${id}.`, `updateLoanRequest-${id}`, e);
  }
}


// Mock service for workflow definitions (used by settings page)
export async function getWorkflowDefinitions(): Promise<{ workflows?: WorkflowDefinition[]; error?: string }> {
  try {
    await simulateDelay(20);
    return { workflows: sessionMockWorkflowDefinitions };
  } catch (e:any) {
    return createErrorResult("Failed to fetch workflow definitions.", "getWorkflowDefinitions", e);
  }
}

export async function saveWorkflowDefinitions(workflows: WorkflowDefinition[]): Promise<{ success?: boolean; error?: string }> {
  try {
    await simulateDelay(50);
    sessionMockWorkflowDefinitions = JSON.parse(JSON.stringify(workflows)); // Update in-memory store
    console.log("[Mock Service:saveWorkflowDefinitions] Workflow definitions updated in mock store.");
    return { success: true };
  } catch (e:any) {
    return createErrorResult("Failed to save workflow definitions.", "saveWorkflowDefinitions", e);
  }
}
