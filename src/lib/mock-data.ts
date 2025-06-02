
import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
import { UserRole, LoanStage } from '@/types/loan'; // LoanStage can still be used for history if needed

const MOCK_REFERENCE_DATE = new Date('2024-07-15T10:00:00.000Z').getTime();

export const mockUsers: User[] = [
  { id: 'user-jane-doe', name: 'Jane Doe', email: 'jane@example.com', role: UserRole.RELATIONSHIP_MANAGER, department: "Origination" },
  { id: 'user-john-smith', name: 'John Smith', email: 'john@example.com', role: UserRole.RELATIONSHIP_MANAGER, department: "Origination" },
  { id: 'user-manager-mike', name: 'Mike Manager', email: 'mike.manager@example.com', role: UserRole.UNDERWRITER, department: "Origination" }, // Example Manager
  { id: 'user-admin-alice', name: 'Alice Admin', email: 'alice.admin@example.com', role: UserRole.ADMIN },
  { id: 'user-underwriter-bob', name: 'Bob Underwriter', email: 'bob.uw@example.com', role: UserRole.UNDERWRITER, department: "Underwriting" },
  { id: 'user-uw-manager-sara', name: 'Sara UW Manager', email: 'sara.uwmanager@example.com', role: UserRole.UNDERWRITER, department: "Underwriting" }, // Example Manager
  { id: 'user-staff-carol', name: 'Carol Staff', email: 'carol.staff@example.com', role: UserRole.STAFF, department: "Closing" },
  { id: 'user-closing-manager-dave', name: 'Dave Closing Mgr', email: 'dave.clmanager@example.com', role: UserRole.STAFF, department: "Closing" }, // Example Manager
];

// --- New Workflow Mock Data ---
const defaultWorkflowStages_v1: WorkflowStageDefinition[] = [
  { id: 'wf1_v1_s1', name: 'Application Intake', responsibleDepartment: 'Origination', defaultTimelineDays: 2, requiredDocumentNames: ['Identification Card', 'Application Form'], percentageWeight: 10 },
  { id: 'wf1_v1_s2', name: 'Initial Document Review', responsibleDepartment: 'Origination', defaultTimelineDays: 3, requiredDocumentNames: ['Proof of Income', 'Bank Statement'], percentageWeight: 20 },
  { id: 'wf1_v1_s3', name: 'Credit Check & Basic Underwriting', responsibleDepartment: 'Underwriting', defaultTimelineDays: 5, requiredDocumentNames: [], percentageWeight: 30 },
  { id: 'wf1_v1_s4', name: 'Final Approval Review', responsibleDepartment: 'Underwriting', defaultTimelineDays: 3, requiredDocumentNames: ['Signed Offer Letter'], percentageWeight: 25 },
  { id: 'wf1_v1_s5', name: 'Funds Disbursement Prep', responsibleDepartment: 'Closing', defaultTimelineDays: 2, requiredDocumentNames: ['Payment Instructions'], percentageWeight: 10 },
  { id: 'wf1_v1_s6', name: 'Loan Closed - Disbursed', responsibleDepartment: 'Closing', defaultTimelineDays: 1, requiredDocumentNames: [], percentageWeight: 5, /* isTerminal: true */ },
];
const defaultWorkflowStages_v2: WorkflowStageDefinition[] = [ // Example of a new version
  { id: 'wf1_v2_s1', name: 'Application Intake (V2)', responsibleDepartment: 'Origination', defaultTimelineDays: 1, requiredDocumentNames: ['Online Application Summary'], percentageWeight: 10 },
  { id: 'wf1_v2_s2', name: 'Automated Document Verification', responsibleDepartment: 'Origination', defaultTimelineDays: 1, requiredDocumentNames: ['Digital ID Upload', 'Income API Consent'], percentageWeight: 20 },
  { id: 'wf1_v2_s3', name: 'AI-Assisted Underwriting', responsibleDepartment: 'Underwriting', defaultTimelineDays: 3, requiredDocumentNames: [], percentageWeight: 35 },
  { id: 'wf1_v2_s4', name: 'Senior Underwriter Review', responsibleDepartment: 'Underwriting', defaultTimelineDays: 2, requiredDocumentNames: ['Risk Assessment Report'], percentageWeight: 20 },
  { id: 'wf1_v2_s5', name: 'Closing & Disbursement', responsibleDepartment: 'Closing', defaultTimelineDays: 1, requiredDocumentNames: ['Final Agreement E-sign'], percentageWeight: 15 },
];


const defaultWorkflow_v1: WorkflowVersion = {
  id: 'wf_v_1',
  workflowDefinitionId: 'wf_def_personal_loan',
  versionNumber: 1,
  description: 'Initial version of the personal loan process.',
  createdAt: new Date(MOCK_REFERENCE_DATE - 30 * 24 * 60 * 60 * 1000).toISOString(),
  stages: defaultWorkflowStages_v1,
};
const defaultWorkflow_v2: WorkflowVersion = {
  id: 'wf_v_2',
  workflowDefinitionId: 'wf_def_personal_loan',
  versionNumber: 2,
  description: 'Updated personal loan process with more automation.',
  createdAt: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
  stages: defaultWorkflowStages_v2,
};

export const mockWorkflowDefinitions: WorkflowDefinition[] = [
  {
    id: 'wf_def_personal_loan',
    name: 'Standard Personal Loan Workflow',
    description: 'Default workflow for processing personal loan applications.',
    isActive: true,
    versions: [defaultWorkflow_v1, defaultWorkflow_v2], // v2 is the latest
  },
  {
    id: 'wf_def_mortgage_loan',
    name: 'Mortgage Application Workflow',
    description: 'Workflow for mortgage applications (currently inactive).',
    isActive: false,
    versions: [{ // Example of a workflow with only one version
      id: 'wf_mort_v_1',
      workflowDefinitionId: 'wf_def_mortgage_loan',
      versionNumber: 1,
      description: 'Initial mortgage process.',
      createdAt: new Date(MOCK_REFERENCE_DATE - 60 * 24 * 60 * 60 * 1000).toISOString(),
      stages: [
        { id: 'mort_s1', name: 'Pre-qualification', responsibleDepartment: 'Mortgage Origination', defaultTimelineDays: 5, requiredDocumentNames: ['Credit Report Consent'], percentageWeight: 10 },
        { id: 'mort_s2', name: 'Property Appraisal', responsibleDepartment: 'Appraisal Management', defaultTimelineDays: 10, requiredDocumentNames: ['Appraisal Order'], percentageWeight: 20 },
        // ... more mortgage stages
      ],
    }],
  }
];
// --- End Workflow Mock Data ---


export let mockLoanRequests: LoanRequest[] = [
  {
    id: 'loan-001',
    loanNumber: 'LN00001',
    customerNumber: 'CUST001',
    customerName: 'Alice Wonderland (Active Workflow V2)',
    customerEmail: 'alice@example.com',
    customerPhone: '555-0101',
    loanAmount: 10000,
    loanType: 'Personal Loan',
    loanPurpose: 'Home Renovation',
    workflowDefinitionId: 'wf_def_personal_loan', // Following active workflow
    workflowVersionId: defaultWorkflow_v2.id,    // Following latest version of active workflow
    currentStageId: defaultWorkflow_v2.stages[0].id, // First stage of V2
    assignedDepartment: defaultWorkflow_v2.stages[0].responsibleDepartment, // Origination
    assignedTo: undefined, // Unassigned within department
    submittedDate: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [],
    history: [
      {
        id: 'hist-1',
        stageName: defaultWorkflow_v2.stages[0].name,
        timestamp: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(),
        userId: 'system',
        userName: 'System',
        notes: 'Loan application submitted. Following Workflow V2. Awaiting assignment in Origination.',
      },
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + (defaultWorkflow_v2.stages[0].defaultTimelineDays -1) * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    isReadyForManagerReview: false,
  },
  {
    id: 'loan-002',
    loanNumber: 'LN00002',
    customerNumber: 'CUST002',
    customerName: 'Bob The Builder (Legacy Workflow V1)',
    customerEmail: 'bob@example.com',
    customerPhone: '555-0102',
    loanAmount: 25000,
    loanType: 'Personal Loan',
    loanPurpose: 'Equipment Purchase',
    workflowDefinitionId: 'wf_def_personal_loan', // Following active workflow definition
    workflowVersionId: defaultWorkflow_v1.id,    // But started on an older version V1
    currentStageId: defaultWorkflow_v1.stages[1].id, // Second stage of V1 ('Initial Document Review')
    assignedDepartment: defaultWorkflow_v1.stages[1].responsibleDepartment, // Origination
    assignedTo: 'user-jane-doe', // Assigned to Jane in Origination
    submittedDate: new Date(MOCK_REFERENCE_DATE - 10 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 3 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [ { id: 'doc-id-payslip', name: 'Payslips', status: 'Submitted' } ],
    history: [
      { id: 'hist-2a', stageName: defaultWorkflow_v1.stages[0].name, timestamp: new Date(MOCK_REFERENCE_DATE - 10 * 24 * 60 * 60 * 1000).toISOString(), userId: 'system', userName: 'System', notes: 'Application submitted (V1 Workflow).' },
      { id: 'hist-2b', stageName: defaultWorkflow_v1.stages[1].name, timestamp: new Date(MOCK_REFERENCE_DATE - 8 * 24 * 60 * 60 * 1000).toISOString(), userId: 'user-manager-mike', userName: 'Mike Manager', notes: 'Assigned to Jane Doe for Initial Document Review.'},
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + 2 * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    isReadyForManagerReview: false,
  },
   {
    id: 'loan-003',
    loanNumber: 'LN00003',
    customerNumber: 'CUST003',
    customerName: 'Charlie Brown (Ready for UW Manager Review)',
    customerEmail: 'charlie@example.com',
    customerPhone: '555-0103',
    loanAmount: 5000,
    loanType: 'Auto Loan',
    loanPurpose: 'Used Car Purchase',
    workflowDefinitionId: 'wf_def_personal_loan',
    workflowVersionId: defaultWorkflow_v1.id, // Still on V1
    currentStageId: defaultWorkflow_v1.stages[2].id, // 'Credit Check & Basic Underwriting'
    assignedDepartment: defaultWorkflow_v1.stages[2].responsibleDepartment, // Underwriting
    assignedTo: 'user-underwriter-bob', // Assigned to Bob
    submittedDate: new Date(MOCK_REFERENCE_DATE - 15 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [ { id: 'doc-dl', name: 'Driver\'s License', status: 'Verified' } ],
    history: [
      { id: 'hist-3prev', stageName: defaultWorkflow_v1.stages[1].name, timestamp: new Date(MOCK_REFERENCE_DATE - 5 * 24 * 60 * 60 * 1000).toISOString(), userId: 'user-jane-doe', userName: 'Jane Doe', notes: 'Initial docs reviewed. Promoted to Underwriting.'},
      { id: 'hist-3', stageName: defaultWorkflow_v1.stages[2].name, timestamp: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(), userId: 'user-underwriter-bob', userName: 'Bob Underwriter', notes: 'Credit check complete. Ready for manager approval to proceed.'},
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + 1 * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    isReadyForManagerReview: true, // Ready for UW Manager (Sara) to review
  },
];
