
import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, DocumentRequirement } from '@/types/loan';
import { DocumentRequirementType } from '@/types/loan';

// UserRole enum is removed from types/loan.ts, so it should not be imported or used here.
// We will assign custom role names directly in the mock user data if needed.

const MOCK_REFERENCE_DATE = new Date('2024-07-15T10:00:00.000Z').getTime();

// App-level User type for mocks (no longer uses UserRole enum)
interface MockAppUser {
  id: string; // This will be Prisma's User ID
  userId?: string; // This would be the ID from Identity Server if syncing
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  department?: Department;
  customRoleName?: string; // Assign custom role by name
  password?: string; // For identity server mock, not stored in Prisma User directly
}


export const mockUsers: MockAppUser[] = [
  { id: 'user-jane-doe', userId: 'identity-jane-doe', name: 'Jane Doe', email: 'jane@example.com', customRoleName: "Loan Officer", department: "Origination", password: 'password' },
  { id: 'user-john-smith', userId: 'identity-john-smith', name: 'John Smith', email: 'john@example.com', customRoleName: "Loan Officer", department: "Origination", password: 'password' },
  { id: 'user-manager-mike', userId: 'identity-manager-mike', name: 'Mike Manager (Origination)', email: 'mike.manager@example.com', customRoleName: "Administrator", department: "Origination", password: 'password' }, // Example admin
  { id: 'user-admin-alice', userId: 'identity-admin-alice', name: 'Alice Admin', email: 'alice.admin@example.com', customRoleName: "Administrator", password: 'password' },
  { id: 'user-underwriter-bob', userId: 'identity-underwriter-bob', name: 'Bob Underwriter', email: 'bob.uw@example.com', customRoleName: "Loan Officer", department: "Underwriting", password: 'password' }, // Example role
  { id: 'user-uw-manager-sara', userId: 'identity-uw-manager-sara', name: 'Sara UW Manager (Underwriting)', email: 'sara.uwmanager@example.com', customRoleName: "Administrator", department: "Underwriting", password: 'password' },
  { id: 'user-staff-carol', userId: 'identity-staff-carol', name: 'Carol Staff (Closing)', email: 'carol.staff@example.com', customRoleName: "Loan Officer", department: "Closing", password: 'password' },
  { id: 'user-closing-manager-dave', userId: 'identity-closing-manager-dave', name: 'Dave Closing Mgr (Closing)', email: 'dave.clmanager@example.com', customRoleName: "Loan Officer", department: "Closing", password: 'password' },
  { id: 'user-credit-analyst', userId: 'identity-credit-analyst', name: 'Chris Analyst', email: 'chris.ca@example.com', customRoleName: "Loan Officer", department: "Credit Analysis", password: 'password' },
  { id: 'user-victor-viewer', userId: 'identity-victor-viewer', name: 'Victor Viewer', email: 'victor@example.com', customRoleName: "Viewer", password: 'password' },
  {
    id: '97ae8737-0d58-48c6-9014-d76184ed67ac', // Prisma User ID
    userId: '97ae8737-0d58-48c6-9014-d76184ed67ac', // Identity Server User ID (using same for consistency)
    name: 'Getaye Temesgen',
    email: 'tgech71@gmail.com',
    firstName: 'Getaye',
    lastName: 'Temesgen',
    phoneNumber: '0912345678',
    customRoleName: "Administrator", // This role should grant all permissions
    department: undefined, // Or assign a default department if needed
    password: 'password' // Default password for mock identity server
  },
  // System user for Prisma seeding (already handled in seed.ts)
  // { id: 'system-prisma', name: 'System Process', email: 'system@loanflow.app', customRoleName: "Administrator", password: 'systempassword' },
];

export const mockDepartments: Department[] = [
  "Origination",
  "Underwriting",
  "Credit Analysis",
  "Closing",
  "Compliance",
  "Servicing"
];

const createDocReq = (id: string, name: string, isMandatory: boolean, type: DocumentRequirementType): DocumentRequirement => ({
  id,
  name,
  isMandatory,
  type,
});

// --- Workflow Mock Data (remains the same) ---
const personalLoan_v1_stages: WorkflowStageDefinition[] = [
  { id: 'pl_v1_s1', name: 'Application Intake (PL V1)', responsibleDepartment: 'Origination', defaultTimelineDays: 2, documentRequirements: [createDocReq('pl_v1_s1_dr1', 'Identification Card', true, DocumentRequirementType.UPLOAD), createDocReq('pl_v1_s1_dr2', 'Application Form', true, DocumentRequirementType.UPLOAD)], percentageWeight: 10, order: 0 },
  { id: 'pl_v1_s2', name: 'Initial Document Review (PL V1)', responsibleDepartment: 'Origination', defaultTimelineDays: 3, documentRequirements: [createDocReq('pl_v1_s2_dr1', 'Proof of Income', true, DocumentRequirementType.UPLOAD), createDocReq('pl_v1_s2_dr2', 'Bank Statement', false, DocumentRequirementType.UPLOAD)], percentageWeight: 20, order: 1 },
  { id: 'pl_v1_s3', name: 'Credit Check (PL V1)', responsibleDepartment: 'Credit Analysis', defaultTimelineDays: 2, documentRequirements: [createDocReq('pl_v1_s3_dr1', 'Credit Report Consent', true, DocumentRequirementType.CHECKBOX)], percentageWeight: 20, order: 2 },
  { id: 'pl_v1_s4', name: 'Basic Underwriting (PL V1)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 3, documentRequirements: [], percentageWeight: 30, order: 3 },
  { id: 'pl_v1_s5', name: 'Final Approval Review (PL V1)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 1, documentRequirements: [createDocReq('pl_v1_s5_dr1', 'Signed Offer Letter', true, DocumentRequirementType.UPLOAD)], percentageWeight: 15, order: 4 },
  { id: 'pl_v1_s6', name: 'Funds Disbursement Prep (PL V1)', responsibleDepartment: 'Closing', defaultTimelineDays: 2, documentRequirements: [createDocReq('pl_v1_s6_dr1', 'Payment Instructions', true, DocumentRequirementType.UPLOAD)], percentageWeight: 0, order: 5 },
  { id: 'pl_v1_s7', name: 'Loan Closed - Disbursed (PL V1)', responsibleDepartment: 'Closing', defaultTimelineDays: 1, documentRequirements: [], percentageWeight: 5, order: 6 },
];
const personalLoan_v2_stages: WorkflowStageDefinition[] = [
  { id: 'pl_v2_s1', name: 'Online Application Intake (PL V2)', responsibleDepartment: 'Origination', defaultTimelineDays: 1, documentRequirements: [createDocReq('pl_v2_s1_dr1', 'Online Application Summary', true, DocumentRequirementType.CHECKBOX)], percentageWeight: 10, order: 0 },
  { id: 'pl_v2_s2', name: 'Automated Document Verification (PL V2)', responsibleDepartment: 'Origination', defaultTimelineDays: 1, documentRequirements: [createDocReq('pl_v2_s2_dr1', 'Digital ID Upload', true, DocumentRequirementType.UPLOAD), createDocReq('pl_v2_s2_dr2', 'Income API Consent', true, DocumentRequirementType.CHECKBOX)], percentageWeight: 15, order: 1 },
  { id: 'pl_v2_s3', name: 'AI-Assisted Credit Scoring (PL V2)', responsibleDepartment: 'Credit Analysis', defaultTimelineDays: 1, documentRequirements: [], percentageWeight: 25, order: 2 },
  { id: 'pl_v2_s4', name: 'Underwriter Review (PL V2)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 2, documentRequirements: [createDocReq('pl_v2_s4_dr1', 'Risk Assessment Report', true, DocumentRequirementType.UPLOAD)], percentageWeight: 30, order: 3 },
  { id: 'pl_v2_s5', name: 'E-Signature & Closing Prep (PL V2)', responsibleDepartment: 'Closing', defaultTimelineDays: 1, documentRequirements: [createDocReq('pl_v2_s5_dr1', 'Final Agreement E-sign', true, DocumentRequirementType.UPLOAD)], percentageWeight: 15, order: 4 },
  { id: 'pl_v2_s6', name: 'Loan Closed - Disbursed (PL V2)', responsibleDepartment: 'Closing', defaultTimelineDays: 1, documentRequirements: [], percentageWeight: 5, order: 5 },
];

const mortgageLoan_v1_stages: WorkflowStageDefinition[] = [
    { id: 'ml_v1_s1', name: 'Pre-qualification Application (ML V1)', responsibleDepartment: 'Origination', defaultTimelineDays: 3, documentRequirements: [createDocReq('ml_v1_s1_dr1','Pre-qual Form', true, DocumentRequirementType.UPLOAD), createDocReq('ml_v1_s1_dr2','ID', true, DocumentRequirementType.UPLOAD)], percentageWeight: 5, order: 0 },
    { id: 'ml_v1_s2', name: 'Full Application & Doc Collection (ML V1)', responsibleDepartment: 'Origination', defaultTimelineDays: 7, documentRequirements: [createDocReq('ml_v1_s2_dr1','Full Application', true, DocumentRequirementType.UPLOAD), createDocReq('ml_v1_s2_dr2','Income Proof', true, DocumentRequirementType.UPLOAD), createDocReq('ml_v1_s2_dr3','Asset Statements', false, DocumentRequirementType.UPLOAD)], percentageWeight: 15, order: 1 },
    { id: 'ml_v1_s3', name: 'Property Appraisal Ordered (ML V1)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 2, documentRequirements: [createDocReq('ml_v1_s3_dr1','Appraisal Request', true, DocumentRequirementType.CHECKBOX)], percentageWeight: 5, order: 2 },
    { id: 'ml_v1_s4', name: 'Appraisal Review & Credit Analysis (ML V1)', responsibleDepartment: 'Credit Analysis', defaultTimelineDays: 5, documentRequirements: [createDocReq('ml_v1_s4_dr1','Appraisal Report', true, DocumentRequirementType.UPLOAD), createDocReq('ml_v1_s4_dr2','Credit Report', true, DocumentRequirementType.UPLOAD)], percentageWeight: 25, order: 3 },
    { id: 'ml_v1_s5', name: 'Underwriting Decision (ML V1)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 5, documentRequirements: [createDocReq('ml_v1_s5_dr1','Underwriting Worksheet', true, DocumentRequirementType.UPLOAD)], percentageWeight: 30, order: 4 },
    { id: 'ml_v1_s6', name: 'Conditional Approval Issued (ML V1)', responsibleDepartment: 'Underwriting', defaultTimelineDays: 1, documentRequirements: [createDocReq('ml_v1_s6_dr1','Conditional Approval Letter', true, DocumentRequirementType.CHECKBOX)], percentageWeight: 5, order: 5 },
    { id: 'ml_v1_s7', name: 'Closing Disclosure & Final Docs (ML V1)', responsibleDepartment: 'Closing', defaultTimelineDays: 3, documentRequirements: [createDocReq('ml_v1_s7_dr1','Closing Disclosure', true, DocumentRequirementType.UPLOAD), createDocReq('ml_v1_s7_dr2','Insurance Binder', true, DocumentRequirementType.UPLOAD)], percentageWeight: 10, order: 6 },
    { id: 'ml_v1_s8', name: 'Loan Closed - Funded (ML V1)', responsibleDepartment: 'Closing', defaultTimelineDays: 1, documentRequirements: [], percentageWeight: 5, order: 7 },
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
        { id: 'al_v1_s1', name: 'Application & Vehicle Info (AL V1)', responsibleDepartment: 'Origination', defaultTimelineDays: 1, documentRequirements: [createDocReq('al_v1_s1_dr1', 'Application Form', true, DocumentRequirementType.UPLOAD), createDocReq('al_v1_s1_dr2', 'Vehicle Purchase Agreement', true, DocumentRequirementType.UPLOAD)], percentageWeight: 20, order: 0 },
        { id: 'al_v1_s2', name: 'Credit & Affordability Check (AL V1)', responsibleDepartment: 'Credit Analysis', defaultTimelineDays: 2, documentRequirements: [createDocReq('al_v1_s2_dr1', 'Income Proof', true, DocumentRequirementType.UPLOAD)], percentageWeight: 40, order: 1 },
        { id: 'al_v1_s3', name: 'Final Review & Funding (AL V1)', responsibleDepartment: 'Closing', defaultTimelineDays: 1, documentRequirements: [createDocReq('al_v1_s3_dr1', 'Insurance Proof', true, DocumentRequirementType.UPLOAD), createDocReq('al_v1_s3_dr2', 'Signed Loan Agreement', true, DocumentRequirementType.UPLOAD)], percentageWeight: 40, order: 2 },
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

const getActiveVersionForLoanTypeForMock = (loanType: string): { definitionId: string, versionId: string, stages: WorkflowStageDefinition[] } | null => {
  const definition = mockWorkflowDefinitions.find(def => def.loanType === loanType);
  if (!definition) return null;
  const activeVersion = definition.versions.find(v => v.isActive);
  if (activeVersion) {
    return { definitionId: definition.id, versionId: activeVersion.id, stages: activeVersion.stages };
  }
  if (definition.versions.length > 0) {
    const latestVersion = [...definition.versions].sort((a,b) => b.versionNumber - a.versionNumber)[0];
    console.warn(`No active version for loan type "${loanType}". Falling back to latest version ${latestVersion.versionNumber}.`);
    return { definitionId: definition.id, versionId: latestVersion.id, stages: latestVersion.stages };
  }
  return null;
};


const personalLoanActiveWfInfo = getActiveVersionForLoanTypeForMock('Personal Loan');
const autoLoanActiveWfInfo = getActiveVersionForLoanTypeForMock('Auto Loan');

// LoanRequest mock data remains mostly the same, assignedTo will use Prisma User IDs
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
    assignedTo: undefined, 
    submittedDate: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [],
    history: [
      {
        id: 'hist-1',
        stageName: personalLoanActiveWfInfo?.stages[0].name || 'N/A',
        timestamp: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(),
        userId: 'system-prisma', // System user ID
        userName: 'System Process',
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
    documents: [ { id: 'doc-po', requirementId: 'al_v1_s1_dr2', name: 'Vehicle Purchase Agreement', status: 'SUBMITTED', uploadedAt: new Date(MOCK_REFERENCE_DATE - 4 * 24 * 60 * 60 * 1000).toISOString(), filePath: '/uploads/mock/po.pdf' } ],
    history: [
      { id: 'hist-2a', stageName: autoLoanActiveWfInfo?.stages[0].name || '', timestamp: new Date(MOCK_REFERENCE_DATE - 5 * 24 * 60 * 60 * 1000).toISOString(), userId: 'system-prisma', userName: 'System Process', notes: `Auto loan submitted. Workflow Version ID: ${autoLoanActiveWfInfo?.versionId}` },
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
    assignedTo: 'user-underwriter-bob', // Prisma User ID for Bob
    submittedDate: new Date(MOCK_REFERENCE_DATE - 15 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [ { id: 'doc-risk', requirementId: 'pl_v2_s4_dr1', name: 'Risk Assessment Report', status: 'VERIFIED', uploadedAt: new Date(MOCK_REFERENCE_DATE - 1 * 24 * 60 * 60 * 1000).toISOString(), filePath: '/uploads/mock/risk.pdf' } ],
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
    workflowVersionId: 'pl_v_1', 
    currentStageId: personalLoan_v1_stages[1].id,
    assignedDepartment: personalLoan_v1_stages[1].responsibleDepartment,
    assignedTo: 'user-jane-doe', // Prisma User ID for Jane
    submittedDate: new Date(MOCK_REFERENCE_DATE - 20 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 18 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [ { id: 'doc-id-card-diana', requirementId: 'pl_v1_s1_dr1', name: 'Identification Card', status: 'VERIFIED', uploadedAt: new Date(MOCK_REFERENCE_DATE - 19 * 24 * 60 * 60 * 1000).toISOString(), filePath: '/uploads/mock/id_diana.pdf' } ],
    history: [
      { id: 'hist-4a', stageName: personalLoan_v1_stages[0].name, timestamp: new Date(MOCK_REFERENCE_DATE - 20 * 24 * 60 * 60 * 1000).toISOString(), userId: 'system-prisma', userName: 'System Process', notes: 'Application submitted (V1 Workflow). Promoted to Initial Doc Review.' },
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
    assignedTo: undefined,
    submittedDate: new Date(MOCK_REFERENCE_DATE - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedDate: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(),
    documents: [ {id: 'doc-digi-id', requirementId: 'pl_v2_s2_dr1', name: 'Digital ID Upload', status: 'SUBMITTED', uploadedAt: new Date(MOCK_REFERENCE_DATE - 2 * 24 * 60 * 60 * 1000).toISOString(), filePath: '/uploads/mock/digi_id_edward.png'}],
    history: [
      { id: 'hist-5a', stageName: personalLoanActiveWfInfo?.stages[0].name || 'N/A', timestamp: new Date(MOCK_REFERENCE_DATE - 3 * 24 * 60 * 60 * 1000).toISOString(), userId: 'system-prisma', userName: 'System Process', notes: 'Online application submitted. Moved to Automated Doc Verification.'},
    ],
    stageDeadline: new Date(MOCK_REFERENCE_DATE + ((personalLoanActiveWfInfo?.stages[1].defaultTimelineDays || 1) - 2) * 24 * 60 * 60 * 1000).toISOString(),
    isOverdue: false,
    isReadyForManagerReview: false,
  },
];

// Update mockUsers to include firstName and lastName if name is a fullName
mockUsers.forEach(user => {
  if (user.name && (!user.firstName || !user.lastName)) {
    const nameParts = user.name.split(' ');
    user.firstName = nameParts[0];
    user.lastName = nameParts.slice(1).join(' ');
  }
});

mockUsers.forEach(user => {
  if (user.password === undefined) {
    user.password = 'password'; 
  }
});
