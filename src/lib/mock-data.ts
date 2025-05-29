
import type { LoanRequest, User } from '@/types/loan';
import { LoanStage, UserRole } from '@/types/loan';

// Define a fixed reference date for consistent mock data generation
const MOCK_REFERENCE_DATE = new Date('2024-07-15T10:00:00.000Z').getTime();

export const mockUsers: User[] = [
  { id: 'user-jane-doe', name: 'Jane Doe', email: 'jane@example.com', role: UserRole.RELATIONSHIP_MANAGER },
  { id: 'user-john-smith', name: 'John Smith', email: 'john@example.com', role: UserRole.RELATIONSHIP_MANAGER },
  { id: 'user-admin-alice', name: 'Alice Admin', email: 'alice.admin@example.com', role: UserRole.ADMIN },
  { id: 'user-underwriter-bob', name: 'Bob Underwriter', email: 'bob.uw@example.com', role: UserRole.UNDERWRITER },
  { id: 'user-staff-carol', name: 'Carol Staff', email: 'carol.staff@example.com', role: UserRole.STAFF },
];

export let mockLoanRequests: LoanRequest[] = [ // Changed to let for potential in-memory updates by service
  {
    id: 'loan-001',
    loanNumber: 'LN00001',
    customerNumber: 'CUST001',
    customerName: 'Alice Wonderland (Unassigned Sample)',
    customerEmail: 'alice@example.com',
    customerPhone: '555-0101',
    loanAmount: 10000,
    loanType: 'Personal Loan',
    loanPurpose: 'Home Renovation',
    currentStage: LoanStage.APPLICATION_SUBMITTED,
    submittedDate: new Date(MOCK_REFERENCE_DATE - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days before reference
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day before reference
    assignedTo: undefined, // Made unassigned
    documents: [
      { id: 'doc-id-1', name: 'Proof of Income', status: 'Pending' },
      { id: 'doc-id-2', name: 'Identity Verification', status: 'Pending' },
    ],
    history: [
      {
        id: 'hist-1',
        stage: LoanStage.APPLICATION_SUBMITTED,
        timestamp: new Date(MOCK_REFERENCE_DATE - 5 * 24 * 60 * 60 * 1000).toISOString(),
        userId: 'system',
        userName: 'System',
        notes: 'Loan application submitted by customer. Initially unassigned.',
      },
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days after reference
    isOverdue: new Date(MOCK_REFERENCE_DATE + 2 * 24 * 60 * 60 * 1000).getTime() < MOCK_REFERENCE_DATE,
    isReadyForManagerReview: false,
  },
  {
    id: 'loan-002',
    loanNumber: 'LN00002',
    customerNumber: 'CUST002',
    customerName: 'Bob The Builder (Unassigned Sample)',
    customerEmail: 'bob@example.com',
    customerPhone: '555-0102',
    loanAmount: 250000,
    loanType: 'Mortgage',
    loanPurpose: 'New House Purchase',
    currentStage: LoanStage.DOCUMENT_COLLECTION,
    submittedDate: new Date(MOCK_REFERENCE_DATE - 10 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: undefined, // Made unassigned
    documents: [
      { id: 'doc-id-3', name: 'Payslips (3 months)', status: 'Submitted' },
      { id: 'doc-id-4', name: 'Bank Statements (6 months)', status: 'Pending' },
      { id: 'doc-id-5', name: 'Property Details', status: 'Pending' },
    ],
    history: [
      {
        id: 'hist-2a',
        stage: LoanStage.APPLICATION_SUBMITTED,
        timestamp: new Date(MOCK_REFERENCE_DATE - 10 * 24 * 60 * 60 * 1000).toISOString(),
        userId: 'system',
        userName: 'System',
        notes: 'Loan application submitted.',
      },
      {
        id: 'hist-2b',
        stage: LoanStage.DOCUMENT_COLLECTION,
        timestamp: new Date(MOCK_REFERENCE_DATE - 8 * 24 * 60 * 60 * 1000).toISOString(),
        userId: 'system', // Changed from John Smith as it's now unassigned
        userName: 'System',
        notes: 'Moved to document collection. Awaiting assignment.',
      },
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + 5 * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: new Date(MOCK_REFERENCE_DATE + 5 * 24 * 60 * 60 * 1000).getTime() < MOCK_REFERENCE_DATE,
    isReadyForManagerReview: false,
  },
  {
    id: 'loan-003',
    loanNumber: 'LN00003',
    customerNumber: 'CUST003',
    customerName: 'Charlie Brown (Review Sample)',
    customerEmail: 'charlie@example.com',
    customerPhone: '555-0103',
    loanAmount: 5000,
    loanType: 'Auto Loan',
    loanPurpose: 'Used Car Purchase',
    currentStage: LoanStage.UNDER_REVIEW,
    submittedDate: new Date(MOCK_REFERENCE_DATE - 15 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 3 * 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: 'user-jane-doe', // Keep assigned for manager review example
    documents: [
      { id: 'doc-id-6', name: 'Driver\'s License', status: 'Verified' },
      { id: 'doc-id-7', name: 'Vehicle Purchase Agreement', status: 'Verified' },
    ],
    history: [
      {
        id: 'hist-3',
        stage: LoanStage.UNDER_REVIEW,
        timestamp: new Date(MOCK_REFERENCE_DATE - 3 * 24 * 60 * 60 * 1000).toISOString(),
        userId: 'user-jane-doe',
        userName: 'Jane Doe',
        notes: 'All documents received. Loan is now under review. Marked complete.',
      },
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).getTime() < MOCK_REFERENCE_DATE,
    isReadyForManagerReview: true, // Example of a loan awaiting manager review
  },
  {
    id: 'loan-004',
    loanNumber: 'LN00004',
    customerNumber: 'CUST004',
    customerName: 'Diana Prince (Approved Sample)',
    customerEmail: 'diana@example.com',
    customerPhone: '555-0104',
    loanAmount: 150000,
    loanType: 'Business Loan',
    loanPurpose: 'Startup Capital',
    currentStage: LoanStage.APPROVED,
    submittedDate: new Date(MOCK_REFERENCE_DATE - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: 'user-john-smith',
    documents: [],
    history: [
        {
        id: 'hist-4',
        stage: LoanStage.APPROVED,
        timestamp: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
        userId: 'user-underwriter-bob',
        userName: 'Bob Underwriter',
        notes: 'Loan approved after final review.',
      },
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + 7 * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: new Date(MOCK_REFERENCE_DATE + 7 * 24 * 60 * 60 * 1000).getTime() < MOCK_REFERENCE_DATE,
    isReadyForManagerReview: false,
  },
   {
    id: 'loan-005',
    loanNumber: 'LN00005',
    customerNumber: 'CUST005',
    customerName: 'Edward Nygma (Info Req. Unassigned Sample)',
    customerEmail: 'edward@example.com',
    customerPhone: '555-0105',
    loanAmount: 2000,
    loanType: 'Personal Loan',
    loanPurpose: 'Debt Consolidation',
    currentStage: LoanStage.ADDITIONAL_INFO_REQUIRED,
    submittedDate: new Date(MOCK_REFERENCE_DATE - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    assignedTo: undefined, // Made unassigned
    documents: [ { id: 'doc-id-8', name: 'Proof of Address', status: 'Submitted' }],
    history: [
      {
        id: 'hist-5',
        stage: LoanStage.ADDITIONAL_INFO_REQUIRED,
        timestamp: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
        userId: 'system', // Was John Smith, changed to system as it's unassigned
        userName: 'System',
        notes: 'Additional income verification needed. Awaiting assignment.',
        requiredFulfilment: 'Customer to provide latest tax return.',
      },
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + 3 * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: new Date(MOCK_REFERENCE_DATE + 3 * 24 * 60 * 60 * 1000).getTime() < MOCK_REFERENCE_DATE,
    isReadyForManagerReview: false,
  },
];
