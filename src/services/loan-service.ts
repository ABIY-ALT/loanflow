
'use server';
import type { LoanRequest } from '@/types/loan';
import { LoanStage } from '@/types/loan';
import { mockLoanRequests, mockUsers } from '@/lib/mock-data';
import { formatISO, parseISO } from 'date-fns';

// Simulate an in-memory store for mock data
let sessionMockLoanRequests: LoanRequest[] = JSON.parse(JSON.stringify(mockLoanRequests)); 

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Loan Service Error (Context: ${context || 'Unknown'}): ${message}`;
  if (originalError) {
    console.error(`[Service:${context || 'Unknown'}] Raw error:`, originalError);
    if (originalError.name && originalError.message) {
      detailedMessage += ` (Details: ${originalError.name} - ${originalError.message})`;
    } else if (typeof originalError === 'string') {
      detailedMessage += ` (Details: ${originalError})`;
    } else {
       detailedMessage += ` (Details: An unknown error structure was caught.)`;
    }
  }
  console.error(detailedMessage); // Log detailed error on server
  return { error: message }; // Return a simpler message to client
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
    if (mappedData[key] && typeof mappedData[key].toDate === 'function') { // Check if it's a Firestore Timestamp
      mappedData[key] = formatISO(mappedData[key].toDate());
    } else if (typeof mappedData[key] === 'object' && mappedData[key] !== null) {
      mappedData[key] = mapTimestampsInDoc(mappedData[key]); // Recursively map nested objects
    } else if (Array.isArray(mappedData[key])) {
      mappedData[key] = mappedData[key].map(item => mapTimestampsInDoc(item)); // Recursively map arrays of objects
    }
  }
  return mappedData;
};


// Helper to simulate async operations
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function addLoanRequest(
  // loanData no longer includes assignedTo
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'currentStage' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline' | 'assignedTo'>
): Promise<{ id?: string; error?: string }> {
  console.log('[Mock Service:addLoanRequest] Received data (no assignee from form):', loanData);
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
      assignedTo: undefined, // New loans are always unassigned initially
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

    sessionMockLoanRequests.unshift(prepareDataForFirestoreWrite(newLoan)); // Using prepareData for consistency, though it's mock
    console.log('[Mock Service:addLoanRequest] Successfully added unassigned loan:', newLoan.id);
    return { id: newLoan.id };

  } catch (e: any) {
    return createErrorResult(`Failed to add mock loan request.`, "addLoanRequest", e);
  }
}

export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string }> {
  try {
    await simulateDelay(150 + Math.random() * 200);
    // Recalculate isOverdue on each fetch for mock data
    const processedLoans = sessionMockLoanRequests.map(loan => {
      const stageDeadline = loan.stageDeadline ? parseISO(loan.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(loan.currentStage) : false;
      return { ...loan, isOverdue };
    });
    return { loans: processedLoans.map(mapTimestampsInDoc) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch mock loan requests.", "getLoanRequests", e);
  }
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: any[]; error?: string }> {
  try {
    await simulateDelay(100 + Math.random() * 150);
    const foundLoan = sessionMockLoanRequests.find(l => l.id === id) || null;
    if (foundLoan) {
      const stageDeadline = foundLoan.stageDeadline ? parseISO(foundLoan.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(foundLoan.currentStage) : false;
      return { loan: mapTimestampsInDoc({ ...foundLoan, isOverdue }), users: mockUsers };
    }
    return { loan: null, users: mockUsers, error: `Mock loan with ID "${id}" not found.` };
  } catch (e: any) {
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
      const updatedLoanData = prepareDataForFirestoreWrite({
        ...sessionMockLoanRequests[loanIndex],
        ...dataToUpdate,
        lastUpdatedDate: formatISO(new Date()),
      });
      sessionMockLoanRequests[loanIndex] = updatedLoanData;
      console.log(`[Mock Service:updateLoanRequest] Successfully updated loan ID: ${id}. New state:`, updatedLoanData);
      return { success: true, updatedLoan: mapTimestampsInDoc(updatedLoanData) };
    }
    return createErrorResult(`Mock loan with ID "${id}" not found for update.`, "updateLoanRequest");
  } catch (e: any)
{
    return createErrorResult(`Failed to update mock loan request for ID ${id}.`, `updateLoanRequest-${id}`, e);
  }
}
