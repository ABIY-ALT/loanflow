
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
export type Department = string; // For now, a list of department names

// Represents a configurable stage within a workflow version
export interface WorkflowStageDefinition {
  id: string; 
  name: string; 
  responsibleDepartment: Department; // Selected from predefined list
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
  loanType: string; // e.g., "Personal Loan", "Mortgage" - links to a type of loan
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
  loanType: string; // This loanType will determine which WorkflowDefinition is used
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

// This enum can be removed if stages are purely defined by WorkflowStageDefinition.name
// Or kept for generic, non-workflow specific states if any remain.
// For now, assuming stages are fully dynamic via workflow definitions.
/*
export enum LoanStage {
  APPLICATION_SUBMITTED = "Application Submitted", 
  PROCESSING = "Processing", 
  ADDITIONAL_INFO_REQUIRED = "Additional Info Required", 
  APPROVED = "Approved", 
  REJECTED = "Rejected", 
  FUNDS_DISBURSED = "Funds Disbursed", 
}
*/
