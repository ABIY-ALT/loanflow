
export enum UserRole {
  ADMIN = "Admin",
  RELATIONSHIP_MANAGER = "Relationship Manager",
  UNDERWRITER = "Underwriter",
  STAFF = "Staff",
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
}

// Represents a predefined department in the system
export type Department = string;

// Represents a configurable stage within a workflow version
export interface WorkflowStageDefinition {
  id: string;
  name: string;
  responsibleDepartment: Department;
  defaultTimelineDays: number;
  requiredDocumentNames: string[];
  percentageWeight: number;
  order: number; // Defines sequence
}

// Represents a specific version of a workflow
export interface WorkflowVersion {
  id: string;
  workflowDefinitionId: string;
  versionNumber: number;
  description?: string;
  createdAt: string; // ISO date string
  stages: WorkflowStageDefinition[];
}

// Represents a workflow template for a specific loan type
export interface WorkflowDefinition {
  id:string;
  name: string;
  loanType: string; // e.g., "Personal Loan", "Mortgage"
  description?: string;
  isActive: boolean; // Only one workflow definition can be active PER LOAN TYPE
  versions: WorkflowVersion[];
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

  workflowDefinitionId: string;
  workflowVersionId: string;
  currentStageId: string;

  submittedDate: string; // ISO date string
  lastUpdatedDate: string; // ISO date string

  assignedDepartment?: string;
  assignedTo?: string; // User ID

  documents: LoanDocument[];
  history: LoanHistoryEntry[];

  stageDeadline?: string; // ISO date string
  isOverdue?: boolean; // Calculated
  isReadyForManagerReview?: boolean;

  // Fields that can be dynamically added by the service layer
  currentStageName?: string;
  isTerminalStage?: boolean;
}
