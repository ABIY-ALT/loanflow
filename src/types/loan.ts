
// Enums remain useful for defining allowed string values
export enum UserRole {
  ADMIN = "Admin", // Matches JWT role claim
  RELATIONSHIP_MANAGER = "Relationship Manager", // Example, adjust if JWT provides different strings
  UNDERWRITER = "Underwriter", // Example
  STAFF = "Staff", // Example
  VIEW_ONLY = "ViewOnly", // Example
  // Add other roles from your JWT as needed
}

// Client-side/Application-level User type based on JWT claims
export interface User {
  id: string; // from "sub" claim
  firstName: string;
  lastName: string;
  fullName: string; // from "unique_name"
  email: string;
  phoneNumber?: string; // from "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone"
  role: UserRole | string; // Role from JWT, can be specific enum or string
  // Add any other relevant claims you want to use in the app
  department?: Department; // Added for consistency from mockUsers
  password?: string; // Added for consistency from mockUsers
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
  name: string; // This will store the original conceptual name or user-provided name
  status: LoanDocumentStatus;
  filePath?: string; // Path to the actual file on the server
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

