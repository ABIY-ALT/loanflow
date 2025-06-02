
'use server';
import type { LoanRequest, User, LoanHistoryEntry, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department } from '@/types/loan';
import { UserRole } from '@/types/loan';
import { mockLoanRequests, mockUsers, mockWorkflowDefinitions, mockDepartments } from '@/lib/mock-data';
import { formatISO, parseISO, addDays, isBefore } from 'date-fns';

let sessionMockLoanRequests: LoanRequest[] = JSON.parse(JSON.stringify(mockLoanRequests));
let sessionMockWorkflowDefinitions: WorkflowDefinition[] = JSON.parse(JSON.stringify(mockWorkflowDefinitions));
let sessionMockDepartments: Department[] = JSON.parse(JSON.stringify(mockDepartments));

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Loan Service Mock Error (Context: ${context || 'Unknown'}): ${message}.`;
  if (originalError) {
    detailedMessage += ` Raw: ${ (typeof originalError === 'object' && originalError !== null) ? JSON.stringify(originalError) : String(originalError)}. Name: ${originalError.name}. Message: ${originalError.message}. Code: ${originalError.code}`;
  }
  console.error(`[Mock Service:${context || 'Unknown'}] Error:`, detailedMessage, originalError);
  return { error: detailedMessage };
};

const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to find the currently active WorkflowVersion for a specific loanType
const getActiveWorkflowVersionForLoanType = (loanType: string): { workflowDef: WorkflowDefinition, activeVersion: WorkflowVersion } | null => {
  const definition = sessionMockWorkflowDefinitions.find(def => def.loanType === loanType);
  if (!definition) return null;
  const activeVersion = definition.versions.find(v => v.isActive);
  if (activeVersion) {
    return { workflowDef: definition, activeVersion: activeVersion };
  }
  return null;
};


// Helper to get a specific stage definition by its ID from any workflow version
const getStageByIdFromAllWorkflows = (versionId: string, stageId: string): WorkflowStageDefinition | null => {
    for (const def of sessionMockWorkflowDefinitions) {
        const version = def.versions.find(v => v.id === versionId);
        if (version) {
            const stage = version.stages.find(s => s.id === stageId);
            if (stage) return stage;
        }
    }
    console.warn(`[Mock Service] Stage with ID ${stageId} not found in version ${versionId} across all workflow definitions.`);
    return null;
};


export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline' | 'assignedTo' | 'isReadyForManagerReview' | 'workflowDefinitionId' | 'workflowVersionId' | 'currentStageId' | 'assignedDepartment' | 'currentStageName' | 'isTerminalStage'>
): Promise<{ id?: string; error?: string }> {
  console.log('[Mock Service:addLoanRequest] Called with data:', loanData);
  
  const activeWorkflowInfo = getActiveWorkflowVersionForLoanType(loanData.loanType);
  if (!activeWorkflowInfo || activeWorkflowInfo.activeVersion.stages.length === 0) {
    return createErrorResult(`No active workflow version or active version has no stages defined for loan type: ${loanData.loanType}. Please configure in settings.`, "addLoanRequest");
  }
  const { workflowDef, activeVersion } = activeWorkflowInfo;
  const firstStage = activeVersion.stages.find(s => s.order === 0);

  if (!firstStage) {
    return createErrorResult(`First stage (order 0) not found for workflow: ${workflowDef.name} Version ${activeVersion.versionNumber}.`, "addLoanRequest");
  }

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
      workflowVersionId: activeVersion.id,
      currentStageId: firstStage.id,
      assignedDepartment: firstStage.responsibleDepartment,
      assignedTo: undefined, 

      submittedDate: formatISO(currentDate),
      lastUpdatedDate: formatISO(currentDate),
      stageDeadline: formatISO(stageDeadlineDate),
      
      history: [
        {
          id: `hist-mock-${Date.now()}`,
          stageName: firstStage.name,
          timestamp: formatISO(currentDate),
          userId: 'mock-system-user',
          userName: 'System/User (Mock)',
          notes: `Loan application submitted. Workflow: ${workflowDef.name} (Version ${activeVersion.versionNumber}, Loan Type: ${workflowDef.loanType}). Initial stage: ${firstStage.name}. Assigned to ${firstStage.responsibleDepartment} department.`,
        },
      ],
      documents: [],
      isOverdue: false,
      isReadyForManagerReview: false,
      currentStageName: firstStage.name,
      isTerminalStage: false,
    };
    
    sessionMockLoanRequests.unshift(newLoan);
    console.log(`[Mock Service:addLoanRequest] sessionMockLoanRequests length BEFORE add: ${sessionMockLoanRequests.length -1 }`);
    console.log(`[Mock Service:addLoanRequest] New loan object created: `, newLoan);
    console.log(`[Mock Service:addLoanRequest] Loan added. New count: ${sessionMockLoanRequests.length}. Added ID: ${newLoan.id}. First ID in array: ${sessionMockLoanRequests[0].id}`);
    return { id: newLoan.id };

  } catch (e: any) {
    return createErrorResult(`Failed to add mock loan request.`, "addLoanRequest", e);
  }
}


export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string; users?: User[] }> {
  console.log('[Mock Service:getLoanRequests] Called.');
  try {
    await simulateDelay(50 + Math.random() * 100);

    const processedLoans = sessionMockLoanRequests.map(loan => {
      const stageDef = getStageByIdFromAllWorkflows(loan.workflowVersionId, loan.currentStageId);
      const stageDeadlineDate = loan.stageDeadline ? parseISO(loan.stageDeadline) : null;
      
      let isTerminalStage = false;
      const workflowVer = sessionMockWorkflowDefinitions.flatMap(wd => wd.versions).find(v => v.id === loan.workflowVersionId);
      if (workflowVer && stageDef) {
          const stageIndex = workflowVer.stages.findIndex(s => s.id === stageDef.id);
          // A stage is terminal if it's the last one in the defined order AND its name suggests completion
          if (stageIndex === workflowVer.stages.length -1) {
              isTerminalStage = true; 
          }
      }
      if (stageDef?.name.toLowerCase().includes("closed") || stageDef?.name.toLowerCase().includes("rejected") || stageDef?.name.toLowerCase().includes("disbursed") || stageDef?.name.toLowerCase().includes("funded")) {
          isTerminalStage = true;
      }

      const isOverdue = stageDeadlineDate ? isBefore(stageDeadlineDate, new Date()) && !isTerminalStage : false;

      const history = Array.isArray(loan.history) ? loan.history : [];
      const documents = Array.isArray(loan.documents) ? loan.documents : [];

      return { 
        ...loan, 
        isOverdue, 
        history, 
        documents, 
        assignedDepartment: stageDef?.responsibleDepartment || loan.assignedDepartment,
        currentStageName: stageDef?.name || 'Unknown Stage From Service',
        isTerminalStage: isTerminalStage,
       };
    });
    console.log(`[Mock Service:getLoanRequests] Returning ${processedLoans.length} loans.`);
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
      const stageDef = getStageByIdFromAllWorkflows(foundLoanData.workflowVersionId, foundLoanData.currentStageId);
      const stageDeadlineDate = foundLoanData.stageDeadline ? parseISO(foundLoanData.stageDeadline) : null;

      let isTerminalStage = false;
      const workflowVer = sessionMockWorkflowDefinitions.flatMap(wd => wd.versions).find(v => v.id === foundLoanData.workflowVersionId);
      if (workflowVer && stageDef) {
          const stageIndex = workflowVer.stages.findIndex(s => s.id === stageDef.id);
          if (stageIndex === workflowVer.stages.length -1) isTerminalStage = true;
      }
       if (stageDef?.name.toLowerCase().includes("closed") || stageDef?.name.toLowerCase().includes("rejected") || stageDef?.name.toLowerCase().includes("disbursed") || stageDef?.name.toLowerCase().includes("funded")) {
          isTerminalStage = true;
      }

      const isOverdue = stageDeadlineDate ? isBefore(stageDeadlineDate, new Date()) && !isTerminalStage : false;

      const history = Array.isArray(foundLoanData.history) ? foundLoanData.history : [];
      const documents = Array.isArray(foundLoanData.documents) ? foundLoanData.documents : [];

      const loan = { 
        ...foundLoanData, 
        isOverdue, 
        history, 
        documents, 
        assignedDepartment: stageDef?.responsibleDepartment || foundLoanData.assignedDepartment,
        currentStageName: stageDef?.name || 'Unknown Stage From Service',
        isTerminalStage: isTerminalStage,
      };
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
      
      const updatedLoanData: LoanRequest = {
        ...originalLoan,
        ...dataToUpdate,
        history: dataToUpdate.history ? [...dataToUpdate.history] : [...originalLoan.history],
        documents: dataToUpdate.documents ? [...dataToUpdate.documents] : [...originalLoan.documents],
        lastUpdatedDate: formatISO(new Date()),
      };
      
      if (dataToUpdate.currentStageId && dataToUpdate.currentStageId !== originalLoan.currentStageId) {
          const newStageDef = getStageByIdFromAllWorkflows(updatedLoanData.workflowVersionId, dataToUpdate.currentStageId);
          if (newStageDef) {
              updatedLoanData.assignedDepartment = newStageDef.responsibleDepartment;
              updatedLoanData.currentStageName = newStageDef.name;
              updatedLoanData.assignedTo = undefined; 
              updatedLoanData.stageDeadline = formatISO(addDays(new Date(), newStageDef.defaultTimelineDays));
              updatedLoanData.isReadyForManagerReview = false; 
          } else {
            console.warn(`[Mock Service:updateLoanRequest] Could not find new stage definition for stageId ${dataToUpdate.currentStageId} in version ${updatedLoanData.workflowVersionId}`);
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

export async function getWorkflowDefinitions(): Promise<{ workflows?: WorkflowDefinition[]; error?: string }> {
  try {
    await simulateDelay(20);
    return { workflows: JSON.parse(JSON.stringify(sessionMockWorkflowDefinitions)) };
  } catch (e:any) {
    return createErrorResult("Failed to fetch workflow definitions.", "getWorkflowDefinitions", e);
  }
}

export async function saveWorkflowDefinitions(workflows: WorkflowDefinition[]): Promise<{ success?: boolean; error?: string }> {
  try {
    await simulateDelay(50);
    sessionMockWorkflowDefinitions = JSON.parse(JSON.stringify(workflows)); 
    console.log("[Mock Service:saveWorkflowDefinitions] Workflow definitions updated in mock store:", sessionMockWorkflowDefinitions);
    return { success: true };
  } catch (e:any) {
    return createErrorResult("Failed to save workflow definitions.", "saveWorkflowDefinitions", e);
  }
}

export async function getDepartments(): Promise<{ departments?: Department[]; error?: string }> {
  try {
    await simulateDelay(10);
    return { departments: JSON.parse(JSON.stringify(sessionMockDepartments)) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch departments.", "getDepartments", e);
  }
}

export async function getAvailableLoanTypesForWorkflow(): Promise<{ loanTypes?: string[]; error?: string }> {
  console.log('[Mock Service:getAvailableLoanTypesForWorkflow] Called.');
  try {
    await simulateDelay(20);
    const availableTypes = new Set<string>();
    sessionMockWorkflowDefinitions.forEach(def => {
      const hasActiveVersion = def.versions.some(v => v.isActive);
      if (hasActiveVersion) {
        availableTypes.add(def.loanType);
      }
    });
    const loanTypes = Array.from(availableTypes).sort();
    console.log(`[Mock Service:getAvailableLoanTypesForWorkflow] Returning available types: ${loanTypes.join(', ')}`);
    return { loanTypes };
  } catch (e: any) {
    return createErrorResult("Failed to fetch available loan types for workflow.", "getAvailableLoanTypesForWorkflow", e);
  }
}
