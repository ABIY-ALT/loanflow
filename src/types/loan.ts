

// Enums remain useful for defining allowed string values
export enum UserRole {
  ADMIN = "ADMIN", // Match Prisma schema
  RELATIONSHIP_MANAGER = "RELATIONSHIP_MANAGER",
  UNDERWRITER = "UNDERWRITER",
  STAFF = "STAFF",
  VIEW_ONLY = "VIEW_ONLY", // New role
}

// Client-side/Application-level User type
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: Department; // Department name string
}

// Represents a predefined department in the system (name string)
export type Department = string; 

// Represents a configurable stage within a workflow version
export interface WorkflowStageDefinition {
  id: string; 
  name: string;
  responsibleDepartment: Department; 
  defaultTimelineDays: number;
  requiredDocumentNames: string[];
  percentageWeight: number;
  order: number; 
  createdAt?: string; 
  updatedAt?: string;
}

// Represents a specific version of a workflow
export interface WorkflowVersion {
  id: string; 
  workflowDefinitionId: string; 
  versionNumber: number;
  createdAt: string; // ISO date string
  stages: WorkflowStageDefinition[];
  isActive: boolean; 
  updatedAt?: string; 
}

// Represents a workflow template for a specific loan type
export interface WorkflowDefinition {
  id: string; 
  name: string;
  loanType: string; 
  description?: string;
  versions: WorkflowVersion[];
  createdAt?: string; 
  updatedAt?: string; 
}

export enum LoanDocumentStatus {
  PENDING = "PENDING", // Match Prisma schema
  SUBMITTED = "SUBMITTED",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
}


export interface LoanDocument {
  id: string; 
  name: string;
  status: LoanDocumentStatus;
  notes?: string;
  uploadedAt?: string; // ISO date string
  createdAt?: string;
  updatedAt?: string;
}

export interface LoanHistoryEntry {
  id: string; 
  userId: string; 
  userName: string; 
  stageName: string; 
  timestamp: string; // ISO date string
  notes?: string;
  requiredFulfilment?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoanRequest {
  id: string; 
  loanNumber: string;
  customerNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerBranch?: string;
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
  isOverdue?: boolean; 
  isReadyForManagerReview?: boolean;

  currentStageName?: string;
  isTerminalStage?: boolean; 

  createdAt?: string;
  updatedAt?: string;
}
    
