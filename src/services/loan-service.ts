
'use server';
import type { LoanRequest, User, LoanHistoryEntry } from '@/types/loan';
import { LoanStage, UserRole } from '@/types/loan';
import { mockLoanRequests, mockUsers } from '@/lib/mock-data';
import { formatISO, parseISO } from 'date-fns';

// Simulate an in-memory store for mock data
let sessionMockLoanRequests: LoanRequest[] = JSON.parse(JSON.stringify(mockLoanRequests)); 

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Loan Service Error (Context: ${context || 'Unknown'}): ${message}.`;
  
  // Log more detailed error on the server for debugging
  if (context === 'addLoanRequest' || context === 'updateLoanRequest') { // More verbose for writes
    console.error(`[Service:${context || 'Unknown'}] Raw error:`, originalError);
    if (originalError instanceof Error) {
      console.error(`[Service:${context || 'Unknown'}] Error name:`, originalError.name);
      console.error(`[Service:${context || 'Unknown'}] Error message:`, originalError.message);
      console.error(`[Service:${context || 'Unknown'}] Error stack:`, originalError.stack);
      detailedMessage += ` (Details: ${originalError.name} - ${originalError.message})`;
    } else if (typeof originalError === 'string') {
      detailedMessage += ` (Details: ${originalError})`;
    } else {
       detailedMessage += ` (Details: An unknown error structure was caught: ${JSON.stringify(originalError)})`;
    }
    console.error(`[Service:${context || 'Unknown'}] Loan Service Error Encountered on Server:`, detailedMessage);
    // For add/update, return a simpler message to client, but log details server-side.
    return { error: message };
  } else { // For reads, we can be a bit more direct with the client
     if (originalError instanceof Error) {
        detailedMessage = `Firebase Error (${originalError.name} - ${originalError.message}): ${message}`;
     } else if (typeof originalError === 'string') {
        detailedMessage = `Firebase Error (${originalError}): ${message}`;
     } else {
        detailedMessage = `Firebase Error (Unknown Structure - ${JSON.stringify(originalError)}): ${message}`;
     }
  }
  return { error: detailedMessage }; 
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
    if (Object.prototype.hasOwnProperty.call(mappedData, key)) {
        if (mappedData[key] && typeof mappedData[key] === 'string') {
            // Attempt to parse if it looks like an ISO string, common from Firestore or manual ISO strings
            // This is a heuristic; for Firestore Timestamps, direct .toDate().toISOString() is better if available.
            // However, since we use ISO strings directly, this might not be needed often for reads.
            // For now, keeping it simple, assuming ISO strings are correctly handled or already strings.
        } else if (typeof mappedData[key] === 'object' && mappedData[key] !== null && !Array.isArray(mappedData[key])) {
          mappedData[key] = mapTimestampsInDoc(mappedData[key]); 
        } else if (Array.isArray(mappedData[key])) {
          mappedData[key] = mappedData[key].map(item => 
            (typeof item === 'object' && item !== null) ? mapTimestampsInDoc(item) : item
          ); 
        }
    }
  }
  return mappedData;
};

const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'currentStage' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline' | 'assignedTo' | 'isReadyForManagerReview'>
): Promise<{ id?: string; error?: string }> {
  console.log('[Mock Service:addLoanRequest] Received data for new loan:', loanData);
  try {
    await simulateDelay(200 + Math.random() * 300);
    const currentDate = new Date();
    
    const newLoan: LoanRequest = {
      id: `loan-mock-${Date.now()}`,
      ...loanData, // Spread the incoming data first
      loanNumber: `LN-MOCK-${String(Date.now()).slice(-5)}`,
      customerNumber: `CUST-MOCK-${String(Date.now()).slice(-4)}`,
      submittedDate: formatISO(currentDate),
      lastUpdatedDate: formatISO(currentDate),
      currentStage: LoanStage.APPLICATION_SUBMITTED, // Explicitly set stage
      assignedTo: undefined, // Explicitly set as unassigned
      history: [
        {
          id: `hist-mock-${Date.now()}`,
          stage: LoanStage.APPLICATION_SUBMITTED,
          timestamp: formatISO(currentDate),
          userId: 'mock-system-user',
          userName: 'System/User (Mock)',
          notes: 'Loan application submitted. Initially unassigned.',
        },
      ],
      documents: [],
      isOverdue: false,
      isReadyForManagerReview: false, 
    };

    const preparedLoanData = prepareDataForFirestoreWrite(newLoan); // Ensure dates are ISO strings
    sessionMockLoanRequests.unshift(preparedLoanData);
    console.log('[Mock Service:addLoanRequest] Successfully added new loan. ID:', newLoan.id, 'Data:', preparedLoanData);
    return { id: newLoan.id };

  } catch (e: any) {
    return createErrorResult(`Failed to add mock loan request.`, "addLoanRequest", e);
  }
}

export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string; users?: User[] }> {
  try {
    await simulateDelay(150 + Math.random() * 200);
    const processedLoans = sessionMockLoanRequests.map(loan => {
      const stageDeadline = loan.stageDeadline ? parseISO(loan.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(loan.currentStage) : false;
      
      const history = Array.isArray(loan.history) ? loan.history : [];
      const documents = Array.isArray(loan.documents) ? loan.documents : [];
      
      return { ...loan, isOverdue, history, documents };
    });
    return { loans: processedLoans.map(mapTimestampsInDoc), users: mockUsers };
  } catch (e: any) {
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
      
      const history = Array.isArray(foundLoanData.history) ? foundLoanData.history : [];
      const documents = Array.isArray(foundLoanData.documents) ? foundLoanData.documents : [];

      const loan = { ...foundLoanData, isOverdue, history, documents };
      return { loan: mapTimestampsInDoc(loan), users: mockUsers };
    }
    return { loan: null, users: mockUsers, error: `Mock loan with ID "${id}" not found.` };
  } catch (e: any)
{
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
      let currentHistory = sessionMockLoanRequests[loanIndex].history;
      if (!Array.isArray(currentHistory)) {
        currentHistory = []; // Ensure it's an array if somehow corrupted
      }

      let newHistory = dataToUpdate.history;
      if (dataToUpdate.history && !Array.isArray(dataToUpdate.history)) {
          console.warn(`[Mock Service:updateLoanRequest] History in dataToUpdate for loan ${id} was not an array, correcting.`);
          newHistory = []; // Or handle as error, for now correcting
      } else if (!dataToUpdate.history) {
          newHistory = currentHistory; // Keep existing if no new history is provided
      }
      
      const updatedLoanData = {
        ...sessionMockLoanRequests[loanIndex],
        ...dataToUpdate,
        history: newHistory, 
        lastUpdatedDate: formatISO(new Date()),
      };

      const preparedData = prepareDataForFirestoreWrite(updatedLoanData); // Prepare all fields, including nested dates
      
      sessionMockLoanRequests[loanIndex] = preparedData;
      console.log(`[Mock Service:updateLoanRequest] Successfully updated loan ID: ${id}. New data:`, preparedData);
      return { success: true, updatedLoan: mapTimestampsInDoc(preparedData) };
    }
    return createErrorResult(`Mock loan with ID "${id}" not found for update.`, "updateLoanRequest");
  } catch (e: any) {
    return createErrorResult(`Failed to update mock loan request for ID ${id}.`, `updateLoanRequest-${id}`, e);
  }
}
