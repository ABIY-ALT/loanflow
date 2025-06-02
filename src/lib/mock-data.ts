
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
  { id: 'pl_v1_s1', name: 'Application Intake (PL V1)', responsibleDepartment: 'Origination', defaultTimelineDays: 2, requiredDocumentNames: ['Identification Card', 'Application Form'], percentageWeight: 10, order: 0 },
  { id: 'pl_v1_s2', name: 'Initial Document Review (PL V1)', responsibleDepartment: 'Origination', defaultTimelineDays: 3, requiredDocumentNames: ['Proof of Income', 'Bank Statement'], percentageWeight: 20, order: 1 },
  { id: 'pl_v1_s3', name: 'Credit Check (PL V1)', responsibleDepartment: 'Credit Analysis', defaultTimelineDays: 2, requiredDocumentNames: ['Credit Report Consent'], percentageWeight: 20, order: 2 },
  { id: 'pl_v1_s4', name: 'Basic Underwriting (PL V1)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 3, requiredDocumentNames: [], percentageWeight: 30, order: 3 },
  { id: 'pl_v1_s5', name: 'Final Approval Review (PL V1)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 1, requiredDocumentNames: ['Signed Offer Letter'], percentageWeight: 15, order: 4 },
  { id: 'pl_v1_s6', name: 'Funds Disbursement Prep (PL V1)', responsibleDepartment: 'Closing', defaultTimelineDays: 2, requiredDocumentNames: ['Payment Instructions'], percentageWeight: 0, order: 5 },
  { id: 'pl_v1_s7', name: 'Loan Closed - Disbursed (PL V1)', responsibleDepartment: 'Closing', defaultTimelineDays: 1, requiredDocumentNames: [], percentageWeight: 5, order: 6 },
];
const personalLoan_v2_stages: WorkflowStageDefinition[] = [
  { id: 'pl_v2_s1', name: 'Online Application Intake (PL V2)', responsibleDepartment: 'Origination', defaultTimelineDays: 1, requiredDocumentNames: ['Online Application Summary'], percentageWeight: 10, order: 0 },
  { id: 'pl_v2_s2', name: 'Automated Document Verification (PL V2)', responsibleDepartment: 'Origination', defaultTimelineDays: 1, requiredDocumentNames: ['Digital ID Upload', 'Income API Consent'], percentageWeight: 15, order: 1 },
  { id: 'pl_v2_s3', name: 'AI-Assisted Credit Scoring (PL V2)', responsibleDepartment: 'Credit Analysis', defaultTimelineDays: 1, requiredDocumentNames: [], percentageWeight: 25, order: 2 },
  { id: 'pl_v2_s4', name: 'Underwriter Review (PL V2)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 2, requiredDocumentNames: ['Risk Assessment Report'], percentageWeight: 30, order: 3 },
  { id: 'pl_v2_s5', name: 'E-Signature & Closing Prep (PL V2)', responsibleDepartment: 'Closing', defaultTimelineDays: 1, requiredDocumentNames: ['Final Agreement E-sign'], percentageWeight: 15, order: 4 },
  { id: 'pl_v2_s6', name: 'Loan Closed - Disbursed (PL V2)', responsibleDepartment: 'Closing', defaultTimelineDays: 1, requiredDocumentNames: [], percentageWeight: 5, order: 5 },
];

const mortgageLoan_v1_stages: WorkflowStageDefinition[] = [
    { id: 'ml_v1_s1', name: 'Pre-qualification Application (ML V1)', responsibleDepartment: 'Origination', defaultTimelineDays: 3, requiredDocumentNames: ['Pre-qual Form', 'ID'], percentageWeight: 5, order: 0 },
    { id: 'ml_v1_s2', name: 'Full Application & Doc Collection (ML V1)', responsibleDepartment: 'Origination', defaultTimelineDays: 7, requiredDocumentNames: ['Full Application', 'Income Proof', 'Asset Statements'], percentageWeight: 15, order: 1 },
    { id: 'ml_v1_s3', name: 'Property Appraisal Ordered (ML V1)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 2, requiredDocumentNames: ['Appraisal Request'], percentageWeight: 5, order: 2 },
    { id: 'ml_v1_s4', name: 'Appraisal Review & Credit Analysis (ML V1)', responsibleDepartment: 'Credit Analysis', defaultTimelineDays: 5, requiredDocumentNames: ['Appraisal Report', 'Credit Report'], percentageWeight: 25, order: 3 },
    { id: 'ml_v1_s5', name: 'Underwriting Decision (ML V1)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 5, requiredDocumentNames: ['Underwriting Worksheet'], percentageWeight: 30, order: 4 },
    { id: 'ml_v1_s6', name: 'Conditional Approval Issued (ML V1)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 1, requiredDocumentNames: ['Conditional Approval Letter'], percentageWeight: 5, order: 5 },
    { id: 'ml_v1_s7', name: 'Closing Disclosure & Final Docs (ML V1)', responsibleDepartment: 'Closing', defaultTimelineDays: 3, requiredDocumentNames: ['Closing Disclosure', 'Insurance Binder'], percentageWeight: 10, order: 6 },
    { id: 'ml_v1_s8', name: 'Loan Closed - Funded (ML V1)', responsibleDepartment: 'Closing', defaultTimelineDays: 1, requiredDocumentNames: [], percentageWeight: 5, order: 7 },
];


export const mockWorkflowDefinitions: WorkflowDefinition[] = [
  {
    id: 'wf_def_personal_loan',
    name: 'Standard Personal Loan Process',
    loanType: 'Personal Loan',
    description: 'Default workflow for processing personal loan applications.',
    versions: [
      {
        id: 'pl_v_1',
        workflowDefinitionId: 'wf_def_personal_loan',
        versionNumber: 1,
        createdAt: new Date(MOCK_REFERENCE_DATE - 30 * 24 * 60 * 60 * 1000).toISOString(),
        stages: personalLoan_v1_stages,
        isActive: false,
      },
      {
        id: 'pl_v_2',
        workflowDefinitionId: 'wf_def_personal_loan',
        versionNumber: 2,
        createdAt: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
        stages: personalLoan_v2_stages,
        isActive: true,
      }
    ],
  },
  {
    id: 'wf_def_auto_loan',
    name: 'Standard Auto Loan Process',
    loanType: 'Auto Loan',
    description: 'Workflow for auto loan applications.',
    versions: [{
      id: 'al_v_1',
      workflowDefinitionId: 'wf_def_auto_loan',
      versionNumber: 1,
      createdAt: new Date(MOCK_REFERENCE_DATE - 45 * 24 * 60 * 60 * 1000).toISOString(),
      stages: [
        { id: 'al_v1_s1', name: 'Application & Vehicle Info (AL V1)', responsibleDepartment: 'Origination', defaultTimelineDays: 1, requiredDocumentNames: ['Application Form', 'Vehicle Purchase Agreement'], percentageWeight: 20, order: 0 },
        { id: 'al_v1_s2', name: 'Credit & Affordability Check (AL V1)', responsibleDepartment: 'Credit Analysis', defaultTimelineDays: 2, requiredDocumentNames: ['Income Proof'], percentageWeight: 40, order: 1 },
        { id: 'al_v1_s3', name: 'Final Review & Funding (AL V1)', responsibleDepartment: 'Closing', defaultTimelineDays: 1, requiredDocumentNames: ['Insurance Proof', 'Signed Loan Agreement'], percentageWeight: 40, order: 2 },
      ],
      isActive: true,
    }],
  },
  {
    id: 'wf_def_mortgage_loan',
    name: 'Standard Mortgage Process',
    loanType: 'Mortgage',
    description: 'Workflow for mortgage applications.',
    versions: [{
      id: 'ml_v_1',
      workflowDefinitionId: 'wf_def_mortgage_loan',
      versionNumber: 1,
      createdAt: new Date(MOCK_REFERENCE_DATE - 60 * 24 * 60 * 60 * 1000).toISOString(),
      stages: mortgageLoan_v1_stages,
      isActive: true,
    }],
  },
];

// --- Initial Loan Requests (Examples) ---
const getActiveVersionForLoanTypeForMock = (loanType: string): { definitionId: string, versionId: string, stages: WorkflowStageDefinition[] } | null => {
  const definition = mockWorkflowDefinitions.find(def => def.loanType === loanType);
  if (!definition) return null;
  const activeVersion = definition.versions.find(v => v.isActive);
  if (activeVersion) {
    return { definitionId: definition.id, versionId: activeVersion.id, stages: activeVersion.stages };
  }
  // Fallback to latest version if no active one is explicitly set for the loan type
  if (definition.versions.length > 0) {
    const latestVersion = [...definition.versions].sort((a,b) => b.versionNumber - a.versionNumber)[0];
    console.warn(`No active version for loan type "${loanType}". Falling back to latest version ${latestVersion.versionNumber}.`);
    return { definitionId: definition.id, versionId: latestVersion.id, stages: latestVersion.stages };
  }
  return null;
};


const personalLoanActiveWfInfo = getActiveVersionForLoanTypeForMock('Personal Loan');
const autoLoanActiveWfInfo = getActiveVersionForLoanTypeForMock('Auto Loan');
const mortgageLoanActiveWfInfo = getActiveVersionForLoanTypeForMock('Mortgage');

export let mockLoanRequests: LoanRequest[] = [
  {
    id: 'loan-001',
    loanNumber: 'LN00001',
    customerNumber: 'CUST001',
    customerName: 'Alice Wonderland (Unassigned Personal Loan)',
    customerEmail: 'alice@example.com',
    customerPhone: '555-0101',
    loanAmount: 10000,
    loanType: 'Personal Loan',
    loanPurpose: 'Home Renovation',
    workflowDefinitionId: personalLoanActiveWfInfo?.definitionId || '',
    workflowVersionId: personalLoanActiveWfInfo?.versionId || '',
    currentStageId: personalLoanActiveWfInfo?.stages[0].id || '',
    assignedDepartment: personalLoanActiveWfInfo?.stages[0].responsibleDepartment,
    assignedTo: undefined, // Unassigned
    submittedDate: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [],
    history: [
      {
        id: 'hist-1',
        stageName: personalLoanActiveWfInfo?.stages[0].name || 'N/A',
        timestamp: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(),
        userId: 'system',
        userName: 'System',
        notes: `Loan application submitted. Workflow Version ID: ${personalLoanActiveWfInfo?.versionId}. Initial stage: ${personalLoanActiveWfInfo?.stages[0].name}. Awaiting assignment in ${personalLoanActiveWfInfo?.stages[0].responsibleDepartment}.`,
      },
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + ((personalLoanActiveWfInfo?.stages[0].defaultTimelineDays || 2) -1) * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    isReadyForManagerReview: false,
  },
  {
    id: 'loan-002',
    loanNumber: 'LN00002',
    customerNumber: 'CUST002',
    customerName: 'Bob The Builder (Unassigned Auto Loan)',
    customerEmail: 'bob@example.com',
    customerPhone: '555-0102',
    loanAmount: 25000,
    loanType: 'Auto Loan',
    loanPurpose: 'New Truck Purchase',
    workflowDefinitionId: autoLoanActiveWfInfo?.definitionId || '',
    workflowVersionId: autoLoanActiveWfInfo?.versionId || '',
    currentStageId: autoLoanActiveWfInfo?.stages[0].id || '',
    assignedDepartment: autoLoanActiveWfInfo?.stages[0].responsibleDepartment,
    assignedTo: undefined,
    submittedDate: new Date(MOCK_REFERENCE_DATE - 5 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [ { id: 'doc-po', name: 'Purchase Order', status: 'Submitted', uploadedAt: new Date(MOCK_REFERENCE_DATE - 4 * 24 * 60 * 60 * 1000).toISOString() } ],
    history: [
      { id: 'hist-2a', stageName: autoLoanActiveWfInfo?.stages[0].name || '', timestamp: new Date(MOCK_REFERENCE_DATE - 5 * 24 * 60 * 60 * 1000).toISOString(), userId: 'system', userName: 'System', notes: `Auto loan submitted. Workflow Version ID: ${autoLoanActiveWfInfo?.versionId}` },
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + ((autoLoanActiveWfInfo?.stages[0].defaultTimelineDays || 1) ) * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    isReadyForManagerReview: false,
  },
   {
    id: 'loan-003',
    loanNumber: 'LN00003',
    customerNumber: 'CUST003',
    customerName: 'Charlie Brown (Personal Loan - For Manager Review)',
    customerEmail: 'charlie@example.com',
    customerPhone: '555-0103',
    loanAmount: 5000,
    loanType: 'Personal Loan',
    loanPurpose: 'Debt Consolidation',
    workflowDefinitionId: personalLoanActiveWfInfo?.definitionId || '',
    workflowVersionId: personalLoanActiveWfInfo?.versionId || '',
    currentStageId: personalLoanActiveWfInfo?.stages[3].id || '',
    assignedDepartment: personalLoanActiveWfInfo?.stages[3].responsibleDepartment,
    assignedTo: 'user-underwriter-bob',
    submittedDate: new Date(MOCK_REFERENCE_DATE - 15 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [ { id: 'doc-risk', name: 'Risk Assessment Report', status: 'Verified', uploadedAt: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString() } ],
    history: [
      { id: 'hist-3prev', stageName: personalLoanActiveWfInfo?.stages[2].name || '', timestamp: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(), userId: 'user-credit-analyst', userName: 'Chris Analyst', notes: 'Credit Scoring complete. Promoted to Underwriting for final review.'},
      { id: 'hist-3', stageName: personalLoanActiveWfInfo?.stages[3].name || '', timestamp: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(), userId: 'user-underwriter-bob', userName: 'Bob Underwriter', notes: 'Detailed review complete. Ready for manager final sign-off.'},
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + ((personalLoanActiveWfInfo?.stages[3].defaultTimelineDays || 2) -1) * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    isReadyForManagerReview: true,
  },
  {
    id: 'loan-004',
    loanNumber: 'LN00004',
    customerNumber: 'CUST004',
    customerName: 'Diana Prince (Personal Loan - Old Inactive V1 Workflow)',
    customerEmail: 'diana@example.com',
    customerPhone: '555-0104',
    loanAmount: 15000,
    loanType: 'Personal Loan',
    loanPurpose: 'Travel',
    workflowDefinitionId: 'wf_def_personal_loan',
    workflowVersionId: 'pl_v_1', // Specifically tied to V1 (which is isActive: false)
    currentStageId: personalLoan_v1_stages[1].id,
    assignedDepartment: personalLoan_v1_stages[1].responsibleDepartment,
    assignedTo: 'user-jane-doe',
    submittedDate: new Date(MOCK_REFERENCE_DATE - 20 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 18 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [ { id: 'doc-id-card-diana', name: 'Identification Card', status: 'Verified', uploadedAt: new Date(MOCK_REFERENCE_DATE - 19 * 24 * 60 * 60 * 1000).toISOString() } ],
    history: [
      { id: 'hist-4a', stageName: personalLoan_v1_stages[0].name, timestamp: new Date(MOCK_REFERENCE_DATE - 20 * 24 * 60 * 60 * 1000).toISOString(), userId: 'system', userName: 'System', notes: 'Application submitted (V1 Workflow). Promoted to Initial Doc Review.' },
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE - 15 * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: true,
    isReadyForManagerReview: false,
  },
   {
    id: 'loan-005',
    loanNumber: 'LN00005',
    customerNumber: 'CUST005',
    customerName: 'Edward Nigma (Unassigned Personal Loan, V2)',
    customerEmail: 'edward@example.com',
    customerPhone: '555-0105',
    loanAmount: 7500,
    loanType: 'Personal Loan',
    loanPurpose: 'Education',
    workflowDefinitionId: personalLoanActiveWfInfo?.definitionId || '',
    workflowVersionId: personalLoanActiveWfInfo?.versionId || '',
    currentStageId: personalLoanActiveWfInfo?.stages[1].id || '',
    assignedDepartment: personalLoanActiveWfInfo?.stages[1].responsibleDepartment,
    assignedTo: undefined, // Unassigned
    submittedDate: new Date(MOCK_REFERENCE_DATE - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [ {id: 'doc-digi-id', name: 'Digital ID Upload', status: 'Submitted', uploadedAt: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString()}],
    history: [
      { id: 'hist-5a', stageName: personalLoanActiveWfInfo?.stages[0].name || 'N/A', timestamp: new Date(MOCK_REFERENCE_DATE - 3 * 24 * 60 * 60 * 1000).toISOString(), userId: 'system', userName: 'System', notes: 'Online application submitted. Moved to Automated Doc Verification.'},
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + ((personalLoanActiveWfInfo?.stages[1].defaultTimelineDays || 1) - 2) * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    isReadyForManagerReview: false,
  },
];

export const logActiveVersionForLoanType = (loanType: string) => {
    const wfDef = mockWorkflowDefinitions.find(def => def.loanType === loanType);
    if (!wfDef) {
        console.log(`No workflow definition found for loan type: ${loanType}`);
        return;
    }
    const activeVersion = wfDef.versions.find(v => v.isActive);
    if (activeVersion) {
        console.log(`Active version for ${loanType}: Version ${activeVersion.versionNumber} (ID: ${activeVersion.id}) from Workflow Definition: ${wfDef.name}`);
    } else {
        console.log(`No active version found for loan type: ${loanType} in definition: ${wfDef.name}`);
    }
};
