
'use server';
import type { LoanRequest, User, LoanHistoryEntry } from '@/types/loan';
import { LoanStage, UserRole } from '@/types/loan';
import { mockLoanRequests, mockUsers } from '@/lib/mock-data';
import { formatISO, parseISO } from 'date-fns';

// Simulate an in-memory store for mock data
let sessionMockLoanRequests: LoanRequest[] = JSON.parse(JSON.stringify(mockLoanRequests)); 

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Loan Service Error (Context: ${context || 'Unknown'}): ${message}.`;
  
  if (originalError) {
    // Log more detailed error on the server for debugging
    console.error(`[Service:${context || 'Unknown'}] Raw error:`, originalError);
    if (originalError instanceof Error) {
      detailedMessage += ` (Details: ${originalError.name} - ${originalError.message})`;
      // console.error(`[Service:${context || 'Unknown'}] Stack:`, originalError.stack); // Optionally log stack
    } else if (typeof originalError === 'string') {
      detailedMessage += ` (Details: ${originalError})`;
    } else {
       detailedMessage += ` (Details: An unknown error structure was caught: ${JSON.stringify(originalError)})`;
    }
  }
  // console.error(detailedMessage); // Log detailed error on server
  return { error: message }; // Return a simpler message to client, or detailedMessage if preferred
};


const prepareDataForFirestoreWrite = (data: any): any => {
  if (data instanceof Date) {
    return formatISO(data);
  }
  if (Array.isArray(data)) {
    return data.map(prepareDataForFirestoreWrite);
  }
  if (typeof data === 'object' && data !== null) {
    const newData: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        newData[key] = prepareDataForFirestoreWrite(data[key]);
      }
    }
    return newData;
  }
  return data;
};

const mapTimestampsInDoc = (docData: any): any => {
  if (!docData) return docData;
  const mappedData = { ...docData };
  for (const key in mappedData) {
    if (mappedData[key] && typeof mappedData[key].toDate === 'function') { 
      mappedData[key] = formatISO(mappedData[key].toDate());
    } else if (typeof mappedData[key] === 'object' && mappedData[key] !== null && !Array.isArray(mappedData[key])) { // Ensure it's an object, not an array
      mappedData[key] = mapTimestampsInDoc(mappedData[key]); 
    } else if (Array.isArray(mappedData[key])) {
      mappedData[key] = mappedData[key].map(item => 
        (typeof item === 'object' && item !== null) ? mapTimestampsInDoc(item) : item
      ); 
    }
  }
  return mappedData;
};

const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'currentStage' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline' | 'assignedTo' | 'isReadyForManagerReview'>
): Promise<{ id?: string; error?: string }> {
  console.log('[Mock Service:addLoanRequest] Received data:', loanData);
  try {
    await simulateDelay(200 + Math.random() * 300);
    const currentDate = new Date();
    
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
      submittedDate: formatISO(currentDate),
      lastUpdatedDate: formatISO(currentDate),
      currentStage: LoanStage.APPLICATION_SUBMITTED,
      assignedTo: undefined, 
      history: [
        {
          id: `hist-mock-${Date.now()}`,
          stage: LoanStage.APPLICATION_SUBMITTED,
          timestamp: formatISO(currentDate),
          userId: 'mock-system-user',
          userName: 'System/User (Mock)',
          notes: 'Loan application submitted (mock). Initially unassigned.',
        },
      ],
      documents: [],
      isOverdue: false,
      isReadyForManagerReview: false, 
    };

    sessionMockLoanRequests.unshift(prepareDataForFirestoreWrite(newLoan));
    console.log('[Mock Service:addLoanRequest] Successfully added unassigned loan:', newLoan.id);
    return { id: newLoan.id };

  } catch (e: any) {
    console.error("[Service:addLoanRequest] Raw error during add:", e);
    return createErrorResult(`Failed to add mock loan request.`, "addLoanRequest", e);
  }
}

export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string; users?: User[] }> {
  try {
    await simulateDelay(150 + Math.random() * 200);
    const processedLoans = sessionMockLoanRequests.map(loan => {
      const stageDeadline = loan.stageDeadline ? parseISO(loan.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(loan.currentStage) : false;
      
      // Ensure history is always an array
      const history = Array.isArray(loan.history) ? loan.history : [];
      
      return { ...loan, isOverdue, history };
    });
    return { loans: processedLoans.map(mapTimestampsInDoc), users: mockUsers };
  } catch (e: any) {
    console.error("[Service:getLoanRequests] Raw error:", e);
    return createErrorResult("Failed to fetch mock loan requests.", "getLoanRequests", e);
  }
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string }> {
  try {
    await simulateDelay(100 + Math.random() * 150);
    const foundLoanData = sessionMockLoanRequests.find(l => l.id === id);
    
    if (foundLoanData) {
      const stageDeadline = foundLoanData.stageDeadline ? parseISO(foundLoanData.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(foundLoanData.currentStage) : false;
      
      // Ensure history is always an array
      const history = Array.isArray(foundLoanData.history) ? foundLoanData.history : [];

      const loan = { ...foundLoanData, isOverdue, history };
      return { loan: mapTimestampsInDoc(loan), users: mockUsers };
    }
    return { loan: null, users: mockUsers, error: `Mock loan with ID "${id}" not found.` };
  } catch (e: any) {
    console.error(`[Service:getLoanRequestById-${id}] Raw error:`, e);
    return createErrorResult(`Failed to fetch mock loan request for ID ${id}.`, `getLoanRequestById-${id}`, e);
  }
}

export async function updateLoanRequest(
  id: string, 
  dataToUpdate: Partial<Omit<LoanRequest, 'id'>>
): Promise<{ success?: boolean; updatedLoan?: LoanRequest; error?: string }> {
   try {
    await simulateDelay(200 + Math.random() * 200);
    console.log(`[Mock Service:updateLoanRequest] Attempting to update loan ID: ${id} with data:`, dataToUpdate);
    const loanIndex = sessionMockLoanRequests.findIndex(l => l.id === id);
    
    if (loanIndex > -1) {
      // Ensure history in dataToUpdate is an array if provided, otherwise spread current history
      let newHistory = sessionMockLoanRequests[loanIndex].history; // Default to existing history
      if (dataToUpdate.history) {
        newHistory = Array.isArray(dataToUpdate.history) ? dataToUpdate.history : [];
      }
      
      const updatedLoanData = prepareDataForFirestoreWrite({
        ...sessionMockLoanRequests[loanIndex],
        ...dataToUpdate,
        history: newHistory, // Use the potentially corrected history
        lastUpdatedDate: formatISO(new Date()),
      });
      
      sessionMockLoanRequests[loanIndex] = updatedLoanData;
      console.log(`[Mock Service:updateLoanRequest] Successfully updated loan ID: ${id}.`);
      return { success: true, updatedLoan: mapTimestampsInDoc(updatedLoanData) };
    }
    return createErrorResult(`Mock loan with ID "${id}" not found for update.`, "updateLoanRequest");
  } catch (e: any) {
    console.error(`[Service:updateLoanRequest-${id}] Raw error during update:`, e);
    return createErrorResult(`Failed to update mock loan request for ID ${id}.`, `updateLoanRequest-${id}`, e);
  }
}
