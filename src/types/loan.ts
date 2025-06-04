
// Enums remain useful for defining allowed string values
export enum UserRole {
  ADMIN = "Admin",
  RELATIONSHIP_MANAGER = "Relationship Manager",
  UNDERWRITER = "Underwriter",
  STAFF = "Staff",
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
  id: string; // Matches Prisma model ID
  name: string;
  responsibleDepartment: Department; // Name of the department
  defaultTimelineDays: number;
  requiredDocumentNames: string[];
  percentageWeight: number;
  order: number; 
  // Prisma's createdAt/updatedAt are Date objects, service layer converts to string for UI
  createdAt?: string; 
  updatedAt?: string;
}

// Represents a specific version of a workflow
export interface WorkflowVersion {
  id: string; // Matches Prisma model ID
  workflowDefinitionId: string; // Foreign key to WorkflowDefinition
  versionNumber: number;
  createdAt: string; // ISO date string
  stages: WorkflowStageDefinition[];
  isActive: boolean; 
  updatedAt?: string; 
}

// Represents a workflow template for a specific loan type
export interface WorkflowDefinition {
  id: string; // Matches Prisma model ID
  name: string;
  loanType: string; 
  description?: string;
  versions: WorkflowVersion[];
  createdAt?: string; 
  updatedAt?: string; 
}

// LoanDocument status enum can be shared
export type LoanDocumentStatus = "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED";


export interface LoanDocument {
  id: string; // Matches Prisma model ID
  // loanRequestId is implicit via relation in Prisma, but good for app type if needed directly
  // loanRequestId?: string; 
  name: string;
  status: LoanDocumentStatus;
  notes?: string;
  uploadedAt?: string; // ISO date string
  createdAt?: string;
  updatedAt?: string;
}

export interface LoanHistoryEntry {
  id: string; // Matches Prisma model ID
  // loanRequestId is implicit via relation in Prisma
  // loanRequestId?: string; 
  // userId is a direct field in Prisma model
  userId: string; 
  userName: string; // Store denormalized, or join User table in Prisma queries
  stageName: string; 
  timestamp: string; // ISO date string
  notes?: string;
  requiredFulfilment?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoanRequest {
  id: string; // Matches Prisma model ID
  loanNumber: string;
  customerNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerBranch?: string;
  loanAmount: number; // Prisma stores as Decimal, convert to number for app
  loanType: string;
  loanPurpose: string;

  // These now map to direct foreign keys in Prisma, mirrors are not strictly needed in app type
  // but kept for compatibility if UI relies on them from previous structure
  workflowDefinitionId: string; 
  workflowVersionId: string; 
  currentStageId: string; 

  // Firestore specific ref paths are removed
  // workflowVersionRefPath?: string; 
  // currentStageRefPath?: string;
  
  submittedDate: string; // ISO date string
  lastUpdatedDate: string; // ISO date string

  assignedDepartment?: string; // Derived from current stage's responsible department
  assignedTo?: string; // User ID (maps to assignedToUserId in Prisma)

  documents: LoanDocument[];
  history: LoanHistoryEntry[];

  stageDeadline?: string; // ISO date string
  isOverdue?: boolean; // Calculated or stored
  isReadyForManagerReview?: boolean;

  // Dynamically added/resolved
  currentStageName?: string;
  isTerminalStage?: boolean; // Calculated or stored

  // Prisma's createdAt/updatedAt are Date objects, service layer converts to string for UI
  createdAt?: string;
  updatedAt?: string;
}
    