
export enum UserRole {
  ADMIN = "Admin",
  RELATIONSHIP_MANAGER = "Relationship Manager",
  UNDERWRITER = "Underwriter",
  STAFF = "Staff",
  // MANAGER is a functional role, not a specific DB role here.
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string; // Optional: Department user belongs to
}

// Represents a configurable stage within a workflow version
export interface WorkflowStageDefinition {
  id: string; // Unique ID for this stage definition within a workflow version
  name: string; // Display name, e.g., "Initial Document Review"
  responsibleDepartment: string; // Name of the department
  defaultTimelineDays: number;
  requiredDocumentNames: string[];
  percentageWeight: number;
  // Order is determined by array position in WorkflowVersion.stages
}

// Represents a specific version of a workflow
export interface WorkflowVersion {
  id: string; // Unique ID for this version
  workflowDefinitionId: string; // FK to WorkflowDefinition
  versionNumber: number;
  description?: string;
  createdAt: string; // ISO date string
  stages: WorkflowStageDefinition[]; // Ordered list of stages
}

// Represents a workflow template
export interface WorkflowDefinition {
  id:string; // Unique ID for the workflow definition
  name: string; // e.g., "Standard Personal Loan Workflow"
  description?: string;
  isActive: boolean; // Only one workflow definition can be active
  versions: WorkflowVersion[]; // All versions of this workflow
  // `activeVersionId` could be a field, or we assume latest version of active workflow is used
}


export interface LoanDocument {
  id: string;
  name: string;
  status: "Pending" | "Submitted" | "Verified" | "Rejected";
  notes?: string;
  uploadedAt?: string; // ISO date string
}

export interface LoanHistoryEntry {
  id: string;
  stageName: string; // Name of the workflow stage at the time of entry
  timestamp: string; // ISO date string
  userId: string;
  userName: string;
  notes?: string;
  requiredFulfilment?: string;
  // Optional: could store oldLoanStageEnum if needed for icons/legacy
  // oldLoanStageEnum?: LoanStage; 
}

export interface LoanRequest {
  id: string;
  loanNumber: string;
  customerNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  loanAmount: number;
  loanType: string;
  loanPurpose: string;
  
  workflowDefinitionId: string; // ID of the WorkflowDefinition this loan follows
  workflowVersionId: string; // ID of the WorkflowVersion this loan follows
  currentStageId: string; // ID of the current WorkflowStageDefinition

  submittedDate: string; // ISO date string
  lastUpdatedDate: string; // ISO date string
  
  assignedDepartment?: string; // Name of the department responsible for the current stage
  assignedTo?: string; // User ID of the assigned staff member

  documents: LoanDocument[];
  history: LoanHistoryEntry[];
  
  stageDeadline?: string; // ISO date string, for current stage
  isOverdue?: boolean; // Calculated
  isReadyForManagerReview?: boolean;
}

// The old LoanStage enum might still be useful for very generic categorizations or terminal states
// but is no longer central to workflow definition.
export enum LoanStage {
  APPLICATION_SUBMITTED = "Application Submitted", // Generic term
  PROCESSING = "Processing", // Generic term
  ADDITIONAL_INFO_REQUIRED = "Additional Info Required", // Specific action state
  APPROVED = "Approved", // Terminal State
  REJECTED = "Rejected", // Terminal State
  FUNDS_DISBURSED = "Funds Disbursed", // Terminal State
}

// This array is no longer used for defining stages in settings.
// It might be used for specific dialogs if they need a generic list of terminal states.
export const terminalLoanStages: LoanStage[] = [
  LoanStage.APPROVED,
  LoanStage.REJECTED,
  LoanStage.FUNDS_DISBURSED,
];
