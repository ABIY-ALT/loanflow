
'use server';
import type { LoanRequest, User } from '@/types/loan';
import { LoanStage, UserRole } from '@/types/loan';
import { mockLoanRequests, mockUsers } from '@/lib/mock-data';
import { formatISO, parseISO, isValid } from 'date-fns';


// Helper to simulate async operations
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simulate an in-memory store for mock data for the duration of the server session
let sessionMockLoanRequests: LoanRequest[] = JSON.parse(JSON.stringify(mockLoanRequests)); // Deep copy


const createErrorResult = (message: string, error?: any, context?: string): { error: string } => {
  let detailedMessage = message;
  if (error) {
    console.error(`[Service:${context || 'Unknown'}] Raw error:`, error); // Log raw error on server
    const errorName = error.name || 'UnknownError';
    const errorMessage = typeof error === 'string' ? error : error.message || 'No specific message';
    const errorCode = error.code || 'N/A';
    detailedMessage = `${message} (Details: ${errorName} - ${errorMessage}, Code: ${errorCode})`;
  }
  console.error(`Loan Service Error Encountered on Server (Context: ${context || 'Unknown'}):`, detailedMessage);
  return { error: detailedMessage };
};


const prepareDataForFirestoreWrite = (data: any): any => {
  if (data === null || data === undefined) {
    return data;
  }
  if (data instanceof Date) {
    return formatISO(data);
  }
  if (Array.isArray(data)) {
    return data.map(item => prepareDataForFirestoreWrite(item));
  }
  if (typeof data === 'object') {
    const result: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = prepareDataForFirestoreWrite(data[key]);
      }
    }
    return result;
  }
  return data;
};

const mapTimestampsInDoc = (docData: any): any => {
  if (!docData) return null;
  const data = { ...docData };
  for (const key in data) {
    if (data[key] && typeof data[key].toDate === 'function') { // Check if it's a Firestore Timestamp
      data[key] = formatISO(data[key].toDate());
    } else if (typeof data[key] === 'string') {
        // Attempt to parse and re-format if it's a string that might be a date
        const parsedDate = parseISO(data[key]);
        if (isValid(parsedDate)) {
            // It's a valid ISO string, ensure it's in our standard format or leave as is
            // data[key] = formatISO(parsedDate); // This might be redundant if already ISO
        }
    }
  }
  return data;
};


export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'currentStage' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline'> & { assignedTo?: string }
): Promise<{ id?: string; error?: string }> {
  console.log('[Service:addLoanRequest] Received data:', loanData);
  try {
    await simulateDelay(200 + Math.random() * 300);
    
    const currentDate = new Date();
    let finalAssignedTo = loanData.assignedTo;

    if (!finalAssignedTo) { // If not assigned from form, pick a random RM as before
      const relationshipManagers = mockUsers.filter(user => user.role === UserRole.RELATIONSHIP_MANAGER);
      if (relationshipManagers.length > 0) {
        finalAssignedTo = relationshipManagers[Math.floor(Math.random() * relationshipManagers.length)].id;
        console.log('[Service:addLoanRequest] Auto-assigning to RM:', finalAssignedTo);
      }
    } else {
      console.log('[Service:addLoanRequest] Using provided assignment:', finalAssignedTo);
    }

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
      assignedTo: finalAssignedTo || undefined,
      history: [
        {
          id: `hist-mock-${Date.now()}`,
          stage: LoanStage.APPLICATION_SUBMITTED,
          timestamp: formatISO(currentDate),
          userId: 'mock-system-user',
          userName: 'System/User',
          notes: 'Loan application submitted (mock).',
        },
      ],
      documents: [],
      isOverdue: false, // Default for new loans
      // stageDeadline would be set based on workflow rules for APPLICATION_SUBMITTED
    };

    console.log('[Service:addLoanRequest] Prepared new loan object for mock store:', newLoan);
    sessionMockLoanRequests.unshift(newLoan);
    return { id: newLoan.id };

  } catch (e: any) {
     // Log more details about the error
    console.error("[Service:addLoanRequest] Raw error during mock addLoanRequest:", e);
    console.error("[Service:addLoanRequest] Error name:", e?.name);
    console.error("[Service:addLoanRequest] Error message:", e?.message);
    console.error("[Service:addLoanRequest] Error stack:", e?.stack);
    // Return a simplified, serializable error message to the client
    return { error: `Mock Add Loan Error: ${e?.name || 'Unknown Error'} - ${e?.message || 'Failed to add mock loan request.'}` };
  }
}

export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string; rawError?: any }> {
  try {
    await simulateDelay(150 + Math.random() * 200);
    const processedLoans = sessionMockLoanRequests.map(loan => {
      const stageDeadline = loan.stageDeadline ? parseISO(loan.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(loan.currentStage) : false;
      return { ...loan, isOverdue };
    });
    return { loans: processedLoans };
  } catch (e: any) {
    return createErrorResult("Failed to fetch mock loan requests.", e, "getLoanRequests");
  }
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string; rawError?: any }> {
  try {
    await simulateDelay(100 + Math.random() * 150);
    const foundLoan = sessionMockLoanRequests.find(l => l.id === id) || null;
    if (foundLoan) {
      const stageDeadline = foundLoan.stageDeadline ? parseISO(foundLoan.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(foundLoan.currentStage) : false;
      return { loan: { ...foundLoan, isOverdue }, users: mockUsers };
    }
    return { loan: null, users: mockUsers, error: `Mock loan with ID "${id}" not found.` };
  } catch (e: any) {
    return createErrorResult(`Failed to fetch mock loan request for ID ${id}.`, e, `getLoanRequestById-${id}`);
  }
}


export async function updateLoanRequest(id: string, dataToUpdate: Partial<Omit<LoanRequest, 'id'>>): Promise<{ success?: boolean; error?: string; rawError?: any }> {
   try {
    await simulateDelay(200 + Math.random() * 200);
    const loanIndex = sessionMockLoanRequests.findIndex(l => l.id === id);
    if (loanIndex > -1) {
      sessionMockLoanRequests[loanIndex] = {
        ...sessionMockLoanRequests[loanIndex],
        ...dataToUpdate,
        lastUpdatedDate: formatISO(new Date()),
      };
      return { success: true };
    }
    return { error: `Mock loan with ID "${id}" not found for update.` };
  } catch (e: any)
 {
    return createErrorResult(`Failed to update mock loan request for ID ${id}.`, e, `updateLoanRequest-${id}`);
  }
}
