
'use server';
import type { LoanRequest } from '@/types/loan';
import { LoanStage } from '@/types/loan';
import { mockLoanRequests } from '@/lib/mock-data';
import { formatISO } from 'date-fns';

// Simulating a delay for mock API calls
const MOCK_API_DELAY = 300;

interface GetLoanRequestsResult {
  loans?: LoanRequest[];
  error?: string; // Keep error handling consistent
}
export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'currentStage' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'assignedTo' | 'stageDeadline'>
): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newLoanId = `mock-loan-${Date.now()}`;
      const newLoan: LoanRequest = {
        id: newLoanId,
        ...loanData,
        loanNumber: `LN-MOCK-${String(Date.now()).slice(-4)}`,
        customerNumber: `CUST-MOCK-${String(Date.now()).slice(-4)}`,
        currentStage: LoanStage.APPLICATION_SUBMITTED,
        submittedDate: formatISO(new Date()),
        lastUpdatedDate: formatISO(new Date()),
        documents: [],
        history: [
          {
            id: `hist-mock-${Date.now()}`,
            stage: LoanStage.APPLICATION_SUBMITTED,
            timestamp: formatISO(new Date()),
            userId: 'system-mock',
            userName: 'Mock System via New Application Form',
            notes: 'Mock loan application submitted.',
          },
        ],
        isOverdue: false,
        // stageDeadline can be calculated based on settings if needed for mock
      };
      // In a more stateful mock, you'd add this to an in-memory array.
      // For this revert, we'll just log and simulate success.
      console.log('Mock Service: Added loan request', newLoan);
      // To see it in the list, you'd ideally push to a mutable mockLoanRequests or manage state elsewhere.
      // For simplicity of revert, the list pages will re-fetch from the static mockLoanRequests.
      resolve(newLoanId);
    }, MOCK_API_DELAY);
  });
}

export async function getLoanRequests(): Promise<GetLoanRequestsResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Returning a copy of mockLoanRequests, sorted
      resolve({ loans: [...mockLoanRequests].sort((a, b) => new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime()) });
    }, MOCK_API_DELAY);
  });
}

export async function getLoanRequestById(id: string): Promise<LoanRequest | undefined> {
 return new Promise((resolve) => {
    setTimeout(() => {
      const loan = mockLoanRequests.find(loan => loan.id === id);
      resolve(loan ? {...loan} : undefined); // Return a copy to prevent direct mutation
    }, MOCK_API_DELAY);
  });
}

export async function updateLoanRequest(id: string, dataToUpdate: Partial<Omit<LoanRequest, 'id'>>): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const loanIndex = mockLoanRequests.findIndex(loan => loan.id === id);
      if (loanIndex > -1) {
        // This would modify the global mockLoanRequests array if it were mutable and not re-imported.
        // For a simple revert where pages manage local state, direct mutation of the mock array is avoided.
        console.log(`Mock Service: Simulating update for loan request ${id} with`, dataToUpdate);
        // To make updates reflect across sessions/reloads without a backend,
        // you'd need a more complex in-memory store or use localStorage.
        // For now, pages will primarily rely on their local state for immediate UI updates.
        resolve();
      } else {
        console.warn(`Mock Service: Loan with ID ${id} not found for update.`);
        reject(new Error(`Mock: Loan with ID ${id} not found.`));
      }
    }, MOCK_API_DELAY);
  });
}
