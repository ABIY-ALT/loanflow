
'use server';
import type { LoanRequest, User } from '@/types/loan';
import { LoanStage, UserRole } from '@/types/loan';
import { mockLoanRequests, mockUsers } from '@/lib/mock-data';
import { formatISO, parseISO } from 'date-fns';

// Helper to simulate async operations
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simulate an in-memory store for mock data for the duration of the server session
let sessionMockLoanRequests: LoanRequest[] = JSON.parse(JSON.stringify(mockLoanRequests)); // Deep copy

export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'currentStage' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'assignedTo' | 'stageDeadline'>
): Promise<{ id?: string; error?: string }> {
  await simulateDelay(200 + Math.random() * 300);
  try {
    const currentDate = new Date();
    const relationshipManagers = mockUsers.filter(user => user.role === UserRole.RELATIONSHIP_MANAGER);
    let assignedToId: string | undefined = undefined;
    if (relationshipManagers.length > 0) {
      assignedToId = relationshipManagers[Math.floor(Math.random() * relationshipManagers.length)].id;
    }

    const newLoan: LoanRequest = {
      id: `loan-mock-${Date.now()}`,
      ...loanData,
      loanNumber: `LN-MOCK-${String(Date.now()).slice(-5)}`,
      customerNumber: `CUST-MOCK-${String(Date.now()).slice(-4)}`,
      submittedDate: formatISO(currentDate),
      lastUpdatedDate: formatISO(currentDate),
      currentStage: LoanStage.APPLICATION_SUBMITTED,
      assignedTo: assignedToId,
      history: [
        {
          id: `hist-mock-${Date.now()}`,
          stage: LoanStage.APPLICATION_SUBMITTED,
          timestamp: formatISO(currentDate),
          userId: 'mock-system-user', // Represents system or initial user
          userName: 'System/User',
          notes: 'Loan application submitted (mock).',
        },
      ],
      documents: [],
      // isOverdue and stageDeadline would typically be set based on workflow rules
      // For mock, isOverdue will be calculated on fetch, stageDeadline can be omitted or mocked based on stage
    };
    sessionMockLoanRequests.unshift(newLoan);
    return { id: newLoan.id };
  } catch (e: any) {
    console.error("Error in mock addLoanRequest:", e);
    return { error: e.message || "Failed to add mock loan request." };
  }
}

export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string }> {
  await simulateDelay(150 + Math.random() * 200);
  try {
    const processedLoans = sessionMockLoanRequests.map(loan => {
      const stageDeadline = loan.stageDeadline ? parseISO(loan.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(loan.currentStage) : false;
      return { ...loan, isOverdue };
    });
    return { loans: processedLoans };
  } catch (e: any) {
    console.error("Error in mock getLoanRequests:", e);
    return { error: e.message || "Failed to fetch mock loan requests." };
  }
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string }> {
  await simulateDelay(100 + Math.random() * 150);
  try {
    const foundLoan = sessionMockLoanRequests.find(l => l.id === id) || null;
    if (foundLoan) {
      const stageDeadline = foundLoan.stageDeadline ? parseISO(foundLoan.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(foundLoan.currentStage) : false;
      return { loan: { ...foundLoan, isOverdue }, users: mockUsers }; // Return mock users as well
    }
    return { loan: null, users: mockUsers, error: `Mock loan with ID "${id}" not found.` };
  } catch (e: any) {
    console.error(`Error in mock getLoanRequestById for ID ${id}:`, e);
    return { error: e.message || `Failed to fetch mock loan request for ID ${id}.`};
  }
}


export async function updateLoanRequest(id: string, dataToUpdate: Partial<Omit<LoanRequest, 'id'>>): Promise<{ success?: boolean; error?: string }> {
  await simulateDelay(200 + Math.random() * 200);
  try {
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
  } catch (e: any) {
    console.error(`Error in mock updateLoanRequest for ID ${id}:`, e);
    return { error: e.message || `Failed to update mock loan request for ID ${id}.`};
  }
}
