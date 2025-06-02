
import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department } from '@/types/loan';
import { UserRole } from '@/types/loan';

const MOCK_REFERENCE_DATE = new Date('2024-07-15T10:00:00.000Z').getTime();

export const mockUsers: User[] = [
  { id: 'user-jane-doe', name: 'Jane Doe', email: 'jane@example.com', role: UserRole.RELATIONSHIP_MANAGER, department: "Origination" },
  { id: 'user-john-smith', name: 'John Smith', email: 'john@example.com', role: UserRole.RELATIONSHIP_MANAGER, department: "Origination" },
  { id: 'user-manager-mike', name: 'Mike Manager (Origination)', email: 'mike.manager@example.com', role: UserRole.UNDERWRITER, department: "Origination" },
  { id: 'user-admin-alice', name: 'Alice Admin', email: 'alice.admin@example.com', role: UserRole.ADMIN },
  { id: 'user-underwriter-bob', name: 'Bob Underwriter', email: 'bob.uw@example.com', role: UserRole.UNDERWRITER, department: "Underwriting" },
  { id: 'user-uw-manager-sara', name: 'Sara UW Manager (Underwriting)', email: 'sara.uwmanager@example.com', role: UserRole.UNDERWRITER, department: "Underwriting" },
  { id: 'user-staff-carol', name: 'Carol Staff (Closing)', email: 'carol.staff@example.com', role: UserRole.STAFF, department: "Closing" },
  { id: 'user-closing-manager-dave', name: 'Dave Closing Mgr (Closing)', email: 'dave.clmanager@example.com', role: UserRole.STAFF, department: "Closing" },
  { id: 'user-credit-analyst', name: 'Chris Analyst', email: 'chris.ca@example.com', role: UserRole.STAFF, department: "Credit Analysis" },
];

export const mockDepartments: Department[] = [
  "Origination",
  "Underwriting",
  "Credit Analysis",
  "Closing",
  "Compliance",
  "Servicing"
];

// --- Workflow Mock Data ---
const personalLoan_v1_stages: WorkflowStageDefinition[] = [
  { id: 'pl_v1_s1', name: 'Application Intake', responsibleDepartment: 'Origination', defaultTimelineDays: 2, requiredDocumentNames: ['Identification Card', 'Application Form'], percentageWeight: 10, order: 0 },
  { id: 'pl_v1_s2', name: 'Initial Document Review', responsibleDepartment: 'Origination', defaultTimelineDays: 3, requiredDocumentNames: ['Proof of Income', 'Bank Statement'], percentageWeight: 20, order: 1 },
  { id: 'pl_v1_s3', name: 'Credit Check', responsibleDepartment: 'Credit Analysis', defaultTimelineDays: 2, requiredDocumentNames: ['Credit Report Consent'], percentageWeight: 20, order: 2 },
  { id: 'pl_v1_s4', name: 'Basic Underwriting', responsibleDepartment: 'Underwriting', defaultTimelineDays: 3, requiredDocumentNames: [], percentageWeight: 30, order: 3 },
  { id: 'pl_v1_s5', name: 'Final Approval Review', responsibleDepartment: 'Underwriting', defaultTimelineDays: 1, requiredDocumentNames: ['Signed Offer Letter'], percentageWeight: 15, order: 4 },
  { id: 'pl_v1_s6', name: 'Funds Disbursement Prep', responsibleDepartment: 'Closing', defaultTimelineDays: 2, requiredDocumentNames: ['Payment Instructions'], percentageWeight: 0, order: 5 },
  { id: 'pl_v1_s7', name: 'Loan Closed - Disbursed', responsibleDepartment: 'Closing', defaultTimelineDays: 1, requiredDocumentNames: [], percentageWeight: 5, order: 6 },
];
const personalLoan_v2_stages: WorkflowStageDefinition[] = [
  { id: 'pl_v2_s1', name: 'Online Application Intake', responsibleDepartment: 'Origination', defaultTimelineDays: 1, requiredDocumentNames: ['Online Application Summary'], percentageWeight: 10, order: 0 },
  { id: 'pl_v2_s2', name: 'Automated Document Verification', responsibleDepartment: 'Origination', defaultTimelineDays: 1, requiredDocumentNames: ['Digital ID Upload', 'Income API Consent'], percentageWeight: 15, order: 1 },
  { id: 'pl_v2_s3', name: 'AI-Assisted Credit Scoring', responsibleDepartment: 'Credit Analysis', defaultTimelineDays: 1, requiredDocumentNames: [], percentageWeight: 25, order: 2 },
  { id: 'pl_v2_s4', name: 'Underwriter Review (V2)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 2, requiredDocumentNames: ['Risk Assessment Report'], percentageWeight: 30, order: 3 },
  { id: 'pl_v2_s5', name: 'E-Signature & Closing Prep', responsibleDepartment: 'Closing', defaultTimelineDays: 1, requiredDocumentNames: ['Final Agreement E-sign'], percentageWeight: 15, order: 4 },
  { id: 'pl_v2_s6', name: 'Loan Closed - Disbursed (V2)', responsibleDepartment: 'Closing', defaultTimelineDays: 1, requiredDocumentNames: [], percentageWeight: 5, order: 5 },
];

const mortgageLoan_v1_stages: WorkflowStageDefinition[] = [
    { id: 'ml_v1_s1', name: 'Pre-qualification Application', responsibleDepartment: 'Origination', defaultTimelineDays: 3, requiredDocumentNames: ['Pre-qual Form', 'ID'], percentageWeight: 5, order: 0 },
    { id: 'ml_v1_s2', name: 'Full Application & Doc Collection', responsibleDepartment: 'Origination', defaultTimelineDays: 7, requiredDocumentNames: ['Full Application', 'Income Proof', 'Asset Statements'], percentageWeight: 15, order: 1 },
    { id: 'ml_v1_s3', name: 'Property Appraisal Ordered', responsibleDepartment: 'Underwriting', defaultTimelineDays: 2, requiredDocumentNames: ['Appraisal Request'], percentageWeight: 5, order: 2 },
    { id: 'ml_v1_s4', name: 'Appraisal Review & Credit Analysis', responsibleDepartment: 'Credit Analysis', defaultTimelineDays: 5, requiredDocumentNames: ['Appraisal Report', 'Credit Report'], percentageWeight: 25, order: 3 },
    { id: 'ml_v1_s5', name: 'Underwriting Decision', responsibleDepartment: 'Underwriting', defaultTimelineDays: 5, requiredDocumentNames: ['Underwriting Worksheet'], percentageWeight: 30, order: 4 },
    { id: 'ml_v1_s6', name: 'Conditional Approval Issued', responsibleDepartment: 'Underwriting', defaultTimelineDays: 1, requiredDocumentNames: ['Conditional Approval Letter'], percentageWeight: 5, order: 5 },
    { id: 'ml_v1_s7', name: 'Closing Disclosure & Final Docs', responsibleDepartment: 'Closing', defaultTimelineDays: 3, requiredDocumentNames: ['Closing Disclosure', 'Insurance Binder'], percentageWeight: 10, order: 6 },
    { id: 'ml_v1_s8', name: 'Loan Closed - Funded', responsibleDepartment: 'Closing', defaultTimelineDays: 1, requiredDocumentNames: [], percentageWeight: 5, order: 7 },
];


export const mockWorkflowDefinitions: WorkflowDefinition[] = [
  {
    id: 'wf_def_personal_loan',
    name: 'Standard Personal Loan',
    loanType: 'Personal Loan',
    description: 'Default workflow for processing personal loan applications.',
    isActive: true, // Active for "Personal Loan" type
    versions: [
      {
        id: 'pl_v_1',
        workflowDefinitionId: 'wf_def_personal_loan',
        versionNumber: 1,
        description: 'Initial version of the personal loan process.',
        createdAt: new Date(MOCK_REFERENCE_DATE - 30 * 24 * 60 * 60 * 1000).toISOString(),
        stages: personalLoan_v1_stages,
      },
      {
        id: 'pl_v_2',
        workflowDefinitionId: 'wf_def_personal_loan',
        versionNumber: 2,
        description: 'Updated personal loan process with more automation (V2).',
        createdAt: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
        stages: personalLoan_v2_stages,
      }
    ],
  },
  {
    id: 'wf_def_auto_loan',
    name: 'Standard Auto Loan',
    loanType: 'Auto Loan',
    description: 'Workflow for auto loan applications.',
    isActive: true, // Active for "Auto Loan" type
    versions: [{
      id: 'al_v_1',
      workflowDefinitionId: 'wf_def_auto_loan',
      versionNumber: 1,
      description: 'Initial auto loan process.',
      createdAt: new Date(MOCK_REFERENCE_DATE - 45 * 24 * 60 * 60 * 1000).toISOString(),
      stages: [ // Simplified stages for auto loan
        { id: 'al_v1_s1', name: 'Application & Vehicle Info', responsibleDepartment: 'Origination', defaultTimelineDays: 1, requiredDocumentNames: ['Application Form', 'Vehicle Purchase Agreement'], percentageWeight: 20, order: 0 },
        { id: 'al_v1_s2', name: 'Credit & Affordability Check', responsibleDepartment: 'Credit Analysis', defaultTimelineDays: 2, requiredDocumentNames: ['Income Proof'], percentageWeight: 40, order: 1 },
        { id: 'al_v1_s3', name: 'Final Review & Funding', responsibleDepartment: 'Closing', defaultTimelineDays: 1, requiredDocumentNames: ['Insurance Proof', 'Signed Loan Agreement'], percentageWeight: 40, order: 2 },
      ],
    }],
  },
  {
    id: 'wf_def_mortgage_loan',
    name: 'Standard Mortgage Process',
    loanType: 'Mortgage',
    description: 'Workflow for mortgage applications.',
    isActive: true, // Active for "Mortgage" type
    versions: [{
      id: 'ml_v_1',
      workflowDefinitionId: 'wf_def_mortgage_loan',
      versionNumber: 1,
      description: 'Initial mortgage process.',
      createdAt: new Date(MOCK_REFERENCE_DATE - 60 * 24 * 60 * 60 * 1000).toISOString(),
      stages: mortgageLoan_v1_stages,
    }],
  },
  { // Example of an older, inactive personal loan workflow definition
    id: 'wf_def_personal_loan_old',
    name: 'Legacy Personal Loan',
    loanType: 'Personal Loan',
    description: 'Older, inactive workflow for personal loans.',
    isActive: false,
    versions: [{
      id: 'pl_v_0_5',
      workflowDefinitionId: 'wf_def_personal_loan_old',
      versionNumber: 1, // Internal versioning, but a distinct definition
      description: 'Very old legacy process.',
      createdAt: new Date(MOCK_REFERENCE_DATE - 300 * 24 * 60 * 60 * 1000).toISOString(),
      stages: [
         { id: 'pl_old_s1', name: 'Manual Application Entry', responsibleDepartment: 'Origination', defaultTimelineDays: 5, requiredDocumentNames: ['Paper Application'], percentageWeight: 50, order: 0 },
         { id: 'pl_old_s2', name: 'Manager Manual Approval', responsibleDepartment: 'Underwriting', defaultTimelineDays: 5, requiredDocumentNames: [], percentageWeight: 50, order: 1 },
      ],
    }],
  }
];

// --- Initial Loan Requests (Examples) ---
// Find active personal loan workflow (should be wf_def_personal_loan, latest version pl_v_2)
const activePersonalLoanWf = mockWorkflowDefinitions.find(wf => wf.loanType === 'Personal Loan' && wf.isActive);
const latestPersonalLoanVersion = activePersonalLoanWf?.versions.sort((a, b) => b.versionNumber - a.versionNumber)[0] || activePersonalLoanWf?.versions[0];

// Find active auto loan workflow
const activeAutoLoanWf = mockWorkflowDefinitions.find(wf => wf.loanType === 'Auto Loan' && wf.isActive);
const latestAutoLoanVersion = activeAutoLoanWf?.versions.sort((a,b) => b.versionNumber - a.versionNumber)[0] || activeAutoLoanWf?.versions[0];

export let mockLoanRequests: LoanRequest[] = [
  {
    id: 'loan-001',
    loanNumber: 'LN00001',
    customerNumber: 'CUST001',
    customerName: 'Alice Wonderland (Personal Loan - Latest Workflow)',
    customerEmail: 'alice@example.com',
    customerPhone: '555-0101',
    loanAmount: 10000,
    loanType: 'Personal Loan', // Matches active Personal Loan workflow
    loanPurpose: 'Home Renovation',
    workflowDefinitionId: latestPersonalLoanVersion?.workflowDefinitionId || '',
    workflowVersionId: latestPersonalLoanVersion?.id || '',
    currentStageId: latestPersonalLoanVersion?.stages[0].id || '',
    assignedDepartment: latestPersonalLoanVersion?.stages[0].responsibleDepartment,
    assignedTo: undefined, // Unassigned within department
    submittedDate: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [],
    history: [
      {
        id: 'hist-1',
        stageName: latestPersonalLoanVersion?.stages[0].name || 'N/A',
        timestamp: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(),
        userId: 'system',
        userName: 'System',
        notes: `Loan application submitted. Workflow: ${activePersonalLoanWf?.name} (V${latestPersonalLoanVersion?.versionNumber}). Initial stage: ${latestPersonalLoanVersion?.stages[0].name}. Awaiting assignment in ${latestPersonalLoanVersion?.stages[0].responsibleDepartment}.`,
      },
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + ((latestPersonalLoanVersion?.stages[0].defaultTimelineDays || 2) -1) * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    isReadyForManagerReview: false,
  },
  {
    id: 'loan-002',
    loanNumber: 'LN00002',
    customerNumber: 'CUST002',
    customerName: 'Bob The Builder (Auto Loan - Assigned)',
    customerEmail: 'bob@example.com',
    customerPhone: '555-0102',
    loanAmount: 25000,
    loanType: 'Auto Loan', // Matches active Auto Loan workflow
    loanPurpose: 'New Truck Purchase',
    workflowDefinitionId: latestAutoLoanVersion?.workflowDefinitionId || '',
    workflowVersionId: latestAutoLoanVersion?.id || '',
    currentStageId: latestAutoLoanVersion?.stages[0].id || '',
    assignedDepartment: latestAutoLoanVersion?.stages[0].responsibleDepartment,
    assignedTo: 'user-jane-doe', // Assigned to Jane in Origination (assuming she handles auto loans too)
    submittedDate: new Date(MOCK_REFERENCE_DATE - 5 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [ { id: 'doc-po', name: 'Purchase Order', status: 'Submitted' } ],
    history: [
      { id: 'hist-2a', stageName: latestAutoLoanVersion?.stages[0].name || '', timestamp: new Date(MOCK_REFERENCE_DATE - 5 * 24 * 60 * 60 * 1000).toISOString(), userId: 'system', userName: 'System', notes: `Auto loan submitted. Workflow: ${activeAutoLoanWf?.name} V${latestAutoLoanVersion?.versionNumber}` },
      { id: 'hist-2b', stageName: latestAutoLoanVersion?.stages[0].name || '', timestamp: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(), userId: 'user-manager-mike', userName: 'Mike Manager (Origination)', notes: 'Assigned to Jane Doe for initial processing.'},
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + ((latestAutoLoanVersion?.stages[0].defaultTimelineDays || 1) ) * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    isReadyForManagerReview: false,
  },
   {
    id: 'loan-003',
    loanNumber: 'LN00003',
    customerNumber: 'CUST003',
    customerName: 'Charlie Brown (Personal Loan - Ready for UW Review)',
    customerEmail: 'charlie@example.com',
    customerPhone: '555-0103',
    loanAmount: 5000,
    loanType: 'Personal Loan',
    loanPurpose: 'Debt Consolidation',
    workflowDefinitionId: latestPersonalLoanVersion?.workflowDefinitionId || '',
    workflowVersionId: latestPersonalLoanVersion?.id || '', // Following V2 of personal loan
    currentStageId: latestPersonalLoanVersion?.stages[3].id || '', // 'Underwriter Review (V2)'
    assignedDepartment: latestPersonalLoanVersion?.stages[3].responsibleDepartment, // Underwriting
    assignedTo: 'user-underwriter-bob', // Assigned to Bob
    submittedDate: new Date(MOCK_REFERENCE_DATE - 15 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [ { id: 'doc-risk', name: 'Risk Assessment Report', status: 'Verified' } ], // Assuming Bob generated this
    history: [
      { id: 'hist-3prev', stageName: latestPersonalLoanVersion?.stages[2].name || '', timestamp: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(), userId: 'user-credit-analyst', userName: 'Chris Analyst', notes: 'AI Credit Scoring complete. Promoted to Underwriting for final review.'},
      { id: 'hist-3', stageName: latestPersonalLoanVersion?.stages[3].name || '', timestamp: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(), userId: 'user-underwriter-bob', userName: 'Bob Underwriter', notes: 'Detailed review complete. Ready for manager final sign-off.'},
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + ((latestPersonalLoanVersion?.stages[3].defaultTimelineDays || 2) -1) * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    isReadyForManagerReview: true, // Ready for UW Manager (Sara) to review
  },
  { // Example of a loan on an OLDER version of a workflow
    id: 'loan-004',
    loanNumber: 'LN00004',
    customerNumber: 'CUST004',
    customerName: 'Diana Prince (Personal Loan - Old V1 Workflow)',
    customerEmail: 'diana@example.com',
    customerPhone: '555-0104',
    loanAmount: 15000,
    loanType: 'Personal Loan', // This loan is still on V1 of Personal Loan workflow
    loanPurpose: 'Travel',
    workflowDefinitionId: 'wf_def_personal_loan', // Belongs to "Standard Personal Loan" definition
    workflowVersionId: 'pl_v_1', // Specifically tied to V1
    currentStageId: personalLoan_v1_stages[1].id, // 'Initial Document Review' from V1
    assignedDepartment: personalLoan_v1_stages[1].responsibleDepartment, // Origination
    assignedTo: undefined, // Unassigned in Origination
    submittedDate: new Date(MOCK_REFERENCE_DATE - 20 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 18 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [ { id: 'doc-id-card-diana', name: 'Identification Card', status: 'Verified' } ],
    history: [
      { id: 'hist-4a', stageName: personalLoan_v1_stages[0].name, timestamp: new Date(MOCK_REFERENCE_DATE - 20 * 24 * 60 * 60 * 1000).toISOString(), userId: 'system', userName: 'System', notes: 'Application submitted (V1 Workflow). Promoted to Initial Doc Review.' },
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE - 15 * 24 * 60 * 60 * 1000).toISOString(), // This one is overdue
    isOverdue: true, // Manually set for testing, service would calculate
    isReadyForManagerReview: false,
  },
];
