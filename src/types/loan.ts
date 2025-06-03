
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
  department?: Department; // Department name string
}

// Represents a predefined department in the system
export type Department = string; // e.g., "Origination", "Underwriting"

// Represents a configurable stage within a workflow version
export interface WorkflowStageDefinition {
  id: string;
  name: string;
  responsibleDepartment: Department; // Name of the department
  defaultTimelineDays: number;
  requiredDocumentNames: string[];
  percentageWeight: number;
  order: number; // Defines sequence
  createdAt?: string; // Optional, may not be present on client-side objects initially
  updatedAt?: string; // Optional
}

// Represents a specific version of a workflow
export interface WorkflowVersion {
  id: string;
  workflowDefinitionId: string;
  versionNumber: number;
  createdAt: string; // ISO date string
  stages: WorkflowStageDefinition[];
  isActive: boolean; // Only one version can be active PER LOAN TYPE for its parent WorkflowDefinition
  updatedAt?: string; // Optional
}

// Represents a workflow template for a specific loan type
export interface WorkflowDefinition {
  id:string;
  name: string;
  loanType: string; // e.g., "Personal Loan", "Mortgage" - defines the type of loan this workflow applies to
  description?: string;
  versions: WorkflowVersion[];
  createdAt?: string; // Optional, as it's set by Firestore
  updatedAt?: string; // Optional
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
  customerBranch?: string; // Added field
  loanAmount: number;
  loanType: string;
  loanPurpose: string;

  // Option 1: Keep these as primary data source if resolved on client/service read
  workflowDefinitionId: string; 
  workflowVersionId: string; 
  currentStageId: string; 

  // Option 2: Firestore specific storage fields (denormalized for querying/linking)
  workflowDefinitionId_mirror?: string; 
  workflowVersionId_mirror?: string; 
  currentStageId_mirror?: string; 

  workflowVersionRefPath?: string; // Path string e.g. "workflowDefinitions/defId/versions/verId"
  currentStageRefPath?: string; // Path string e.g. "workflowDefinitions/defId/versions/verId/stages/stageId"
  
  // Optional: Keep old DocumentReference fields if needed during transition or specific server logic
  workflowVersionRef?: any; 
  currentStageRef?: any; 

  submittedDate: string; // ISO date string
  lastUpdatedDate: string; // ISO date string

  assignedDepartment?: string; // Name of the department responsible for the current stage
  assignedTo?: string; // User ID

  documents: LoanDocument[];
  history: LoanHistoryEntry[];

  stageDeadline?: string; // ISO date string
  isOverdue?: boolean; // Calculated
  isReadyForManagerReview?: boolean;

  // Dynamically added by service layer or resolved from references
  currentStageName?: string;
  isTerminalStage?: boolean;

  // Firestore specific technical fields
  assignedToUserId?: string | null; // Store the actual assigned user ID in Firestore this way
  createdAt?: string; // Firestore serverTimestamp on create, converted to ISO on read
  updatedAt?: string; // Firestore serverTimestamp on update, converted to ISO on read
}

