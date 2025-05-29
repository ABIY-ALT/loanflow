
'use server';
import type { LoanRequest, User } from '@/types/loan';
import { LoanStage, UserRole } from '@/types/loan';
import { mockLoanRequests, mockUsers } from '@/lib/mock-data';
import { formatISO, parseISO, isValid } from 'date-fns';

// Helper to simulate async operations
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simulate an in-memory store for mock data
let sessionMockLoanRequests: LoanRequest[] = JSON.parse(JSON.stringify(mockLoanRequests)); 

const createMockErrorResult = (message: string, context?: string): { error: string } => {
  const detailedMessage = `Mock Service Error (${context || 'Unknown'}): ${message}`;
  console.error(detailedMessage); // Log mock errors on server
  return { error: message }; // Return a simpler message to client
};


export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'currentStage' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline'> & { assignedTo?: string }
): Promise<{ id?: string; error?: string }> {
  console.log('[Mock Service:addLoanRequest] Received data:', loanData);
  try {
    await simulateDelay(200 + Math.random() * 300);
    
    const currentDate = new Date();
    let finalAssignedTo = loanData.assignedTo;

    if (!finalAssignedTo && loanData.assignedTo !== undefined) { // explicitly unassigned
        finalAssignedTo = undefined;
    } else if (!finalAssignedTo) { // Not specified, try auto-assign
      const relationshipManagers = mockUsers.filter(user => user.role === UserRole.RELATIONSHIP_MANAGER);
      if (relationshipManagers.length > 0) {
        finalAssignedTo = relationshipManagers[Math.floor(Math.random() * relationshipManagers.length)].id;
      }
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
      assignedTo: finalAssignedTo,
      history: [
        {
          id: `hist-mock-${Date.now()}`,
          stage: LoanStage.APPLICATION_SUBMITTED,
          timestamp: formatISO(currentDate),
          userId: 'mock-system-user',
          userName: 'System/User (Mock)',
          notes: 'Loan application submitted (mock).',
        },
      ],
      documents: [],
      isOverdue: false,
    };

    sessionMockLoanRequests.unshift(newLoan);
    return { id: newLoan.id };

  } catch (e: any) {
    return createMockErrorResult(`Failed to add mock loan request. ${e.message}`, "addLoanRequest");
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
    return { loans: processedLoans };
  } catch (e: any) {
    return createMockErrorResult("Failed to fetch mock loan requests.", "getLoanRequests");
  }
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string }> {
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
    return createMockErrorResult(`Failed to fetch mock loan request for ID ${id}.`, `getLoanRequestById-${id}`);
  }
}


export async function updateLoanRequest(
  id: string, 
  dataToUpdate: Partial<Omit<LoanRequest, 'id'>>
): Promise<{ success?: boolean; updatedLoan?: LoanRequest; error?: string }> {
   try {
    await simulateDelay(200 + Math.random() * 200);
    const loanIndex = sessionMockLoanRequests.findIndex(l => l.id === id);
    if (loanIndex > -1) {
      const updatedLoan = {
        ...sessionMockLoanRequests[loanIndex],
        ...dataToUpdate,
        lastUpdatedDate: formatISO(new Date()),
      };
      sessionMockLoanRequests[loanIndex] = updatedLoan;
      return { success: true, updatedLoan };
    }
    return createMockErrorResult(`Mock loan with ID "${id}" not found for update.`, "updateLoanRequest");
  } catch (e: any) {
    return createMockErrorResult(`Failed to update mock loan request for ID ${id}. ${e.message}`, `updateLoanRequest-${id}`);
  }
}
