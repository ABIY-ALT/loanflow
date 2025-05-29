
'use server';
import type { LoanRequest, User, LoanHistoryEntry } from '@/types/loan';
import { LoanStage, UserRole } from '@/types/loan';
import { mockLoanRequests, mockUsers } from '@/lib/mock-data';
import { formatISO, parseISO } from 'date-fns';

// Simulate an in-memory store for mock data
let sessionMockLoanRequests: LoanRequest[] = JSON.parse(JSON.stringify(mockLoanRequests));

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Loan Service Mock Error (Context: ${context || 'Unknown'}): ${message}.`;
  if (originalError) {
    detailedMessage += ` Raw: ${ (typeof originalError === 'object' && originalError !== null) ? JSON.stringify(originalError) : String(originalError)}. Name: ${originalError.name}. Message: ${originalError.message}. Code: ${originalError.code}`;
  }
  console.error(`[Mock Service:${context || 'Unknown'}] Error:`, detailedMessage, originalError);
  return { error: detailedMessage };
};

const prepareDataForMockWrite = (data: any): any => {
  if (data instanceof Date) {
    return formatISO(data);
  }
  if (Array.isArray(data)) {
    return data.map(prepareDataForMockWrite);
  }
  if (typeof data === 'object' && data !== null) {
    const newData: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        newData[key] = prepareDataForMockWrite(data[key]);
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
        if (typeof mappedData[key] === 'object' && mappedData[key] !== null && !Array.isArray(mappedData[key])) {
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
  console.log('[Mock Service:addLoanRequest] Called.');
  console.log('[Mock Service:addLoanRequest] sessionMockLoanRequests length BEFORE add:', sessionMockLoanRequests.length);
  console.log('[Mock Service:addLoanRequest] First 3 IDs BEFORE add:', sessionMockLoanRequests.slice(0, 3).map(l => l.id));
  console.log('[Mock Service:addLoanRequest] Received data for new loan:', loanData);

  try {
    await simulateDelay(50 + Math.random() * 100);
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
          notes: 'Loan application submitted. Initially unassigned.',
        },
      ],
      documents: [],
      isOverdue: false,
      isReadyForManagerReview: false,
    };
    console.log('[Mock Service:addLoanRequest] New loan object created:', JSON.stringify(newLoan, null, 2));

    const preparedLoanData = prepareDataForMockWrite(newLoan);
    console.log('[Mock Service:addLoanRequest] Loan data prepared for unshift:', JSON.stringify(preparedLoanData, null, 2));
    
    sessionMockLoanRequests.unshift(preparedLoanData);
    
    console.log(`[Mock Service:addLoanRequest] Loan added. New count: ${sessionMockLoanRequests.length}. Added ID: ${newLoan.id}. First ID in array: ${sessionMockLoanRequests[0]?.id}`);
    console.log('[Mock Service:addLoanRequest] First 3 IDs AFTER add:', sessionMockLoanRequests.slice(0, 3).map(l => l.id));
    
    return { id: newLoan.id };

  } catch (e: any) {
    console.error('[Mock Service:addLoanRequest] Raw error during operation:', e);
    return createErrorResult(`Failed to add mock loan request.`, "addLoanRequest", e);
  }
}

export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string; users?: User[] }> {
  console.log('[Mock Service:getLoanRequests] Called.');
  console.log('[Mock Service:getLoanRequests] sessionMockLoanRequests length on fetch:', sessionMockLoanRequests.length);
  console.log('[Mock Service:getLoanRequests] First 3 IDs on fetch:', sessionMockLoanRequests.slice(0, 3).map(l => l.id));
  try {
    await simulateDelay(50 + Math.random() * 100);

    const processedLoans = sessionMockLoanRequests.map(loan => {
      const stageDeadline = loan.stageDeadline ? parseISO(loan.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(loan.currentStage) : false;

      const history = Array.isArray(loan.history) ? loan.history : []; // Ensure history is an array
      const documents = Array.isArray(loan.documents) ? loan.documents : []; // Ensure documents is an array

      return { ...loan, isOverdue, history, documents };
    });
    return { loans: processedLoans.map(mapTimestampsInDoc), users: mockUsers };
  } catch (e: any) {
    return createErrorResult("Failed to fetch mock loan requests.", "getLoanRequests", e);
  }
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string }> {
  try {
    await simulateDelay(50 + Math.random() * 50);
    const foundLoanData = sessionMockLoanRequests.find(l => l.id === id);
     console.log(`[Mock Service:getLoanRequestById] Attempting to find loan with ID: ${id}. Found: ${!!foundLoanData}`);

    if (foundLoanData) {
      const stageDeadline = foundLoanData.stageDeadline ? parseISO(foundLoanData.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(foundLoanData.currentStage) : false;

      const history = Array.isArray(foundLoanData.history) ? foundLoanData.history : [];
      const documents = Array.isArray(foundLoanData.documents) ? foundLoanData.documents : [];

      const loan = { ...foundLoanData, isOverdue, history, documents };
      return { loan: mapTimestampsInDoc(loan), users: mockUsers };
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
    await simulateDelay(50 + Math.random() * 100);
    console.log(`[Mock Service:updateLoanRequest] Attempting to update loan ID: ${id} with data:`, dataToUpdate);
    const loanIndex = sessionMockLoanRequests.findIndex(l => l.id === id);

    if (loanIndex > -1) {
      let currentHistory = sessionMockLoanRequests[loanIndex].history;
      if (!Array.isArray(currentHistory)) {
        console.warn(`[Mock Service:updateLoanRequest] Corrected non-array history for loan ${id}`);
        currentHistory = [];
      }

      let newHistory = dataToUpdate.history;
      if (dataToUpdate.history && !Array.isArray(dataToUpdate.history)) {
          console.warn(`[Mock Service:updateLoanRequest] History in dataToUpdate for loan ${id} was not an array, correcting.`);
          newHistory = currentHistory; 
      } else if (!dataToUpdate.history) {
          newHistory = currentHistory;
      }

      const updatedLoanData: LoanRequest = {
        ...sessionMockLoanRequests[loanIndex],
        ...dataToUpdate,
        history: newHistory as LoanHistoryEntry[], 
        lastUpdatedDate: formatISO(new Date()),
      };

      const preparedData = prepareDataForMockWrite(updatedLoanData);
      sessionMockLoanRequests[loanIndex] = preparedData;
      console.log(`[Mock Service:updateLoanRequest] Successfully updated loan ID: ${id}.`);
      return { success: true, updatedLoan: mapTimestampsInDoc(preparedData) };
    }
    console.warn(`[Mock Service:updateLoanRequest] Loan with ID "${id}" not found for update.`);
    return createErrorResult(`Mock loan with ID "${id}" not found for update.`, "updateLoanRequest");
  } catch (e: any) {
    return createErrorResult(`Failed to update mock loan request for ID ${id}.`, `updateLoanRequest-${id}`, e);
  }
}
