
import type { AppPermission } from '@/lib/permissions';

// Represents a predefined department in the system (name string)
export type Department = string;

// Represents a configurable sector, e.g., "Agriculture", "Manufacturing"
export interface Sector {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// Represents a configurable request type, e.g., "New Loan", "Restructuring"
export interface RequestType {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}


export interface District {
  id: string;
  name: string;
}

export interface Branch {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
}


// Application-level User type, populated from Prisma after token validation
export interface User {
  id: string; // This is the Prisma User ID, which should align with JWT 'sub' after registration
  firstName?: string; // Made optional as not all systems might provide it
  lastName?: string; // Made optional
  fullName: string; // Typically derived if firstName/lastName exist, or from a 'name' claim
  email: string;
  phoneNumber?: string;
  isPasswordChanged: boolean; // Flag for forced password change
  isActive: boolean; // Added to manage user status

  departmentId?: string;
  department?: Department; // Name of the department
  districtId?: string;
  districtName?: string;

  customRoleId?: string;
  customRoleName?: string; // Name of the custom role
  permissions: AppPermission[]; // All permissions granted by the custom role
  assignedBranches?: string[]; // Branches mapped to the user (for CRMs)
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  branch?: string;
  loanRequests: Pick<LoanRequest, 'id' | 'loanNumber' | 'loanAmount' | 'submittedDate' | 'currentStageName'>[];
}

export interface CustomerWithDepartment extends Customer {
    mostRecentDepartment?: Department;
    mostRecentStageName?: string;
}


export enum DocumentRequirementType {
  UPLOAD = "UPLOAD",
  CHECKBOX = "CHECKBOX",
}

export interface DocumentRequirement {
  id: string;
  name:string;
  isMandatory: boolean;
  type: DocumentRequirementType;
}

// Represents a configurable stage within a workflow version
export interface WorkflowStageDefinition {
  id: string;
  name: string;
  responsibleDepartment: Department;
  defaultTimelineDays: number;
  documentRequirements: DocumentRequirement[];
  percentageWeight: number;
  order: number;
  availableStatuses?: Record<Department, string[]>; // Department-specific statuses
  allowedRoles: string[]; // Role names allowed to act on this stage
  requiresApproval: boolean; // If false, user can promote stage directly
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

// Represents a workflow template for a specific combination
export interface WorkflowDefinition {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
  sectorId: string;
  sectorName: string;
  parentSectorId?: string;
  parentSectorName?: string;
  description?: string;
  versions: WorkflowVersion[];
  order: number; // Added for ordering
  createdAt?: string;
  updatedAt?: string;
}

export enum LoanDocumentStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
}


export interface LoanDocument {
  id: string;
  name: string; // Name of the requirement
  requirementId: string | null; // Foreign key to the DocumentRequirement
  status: LoanDocumentStatus;
  filePath?: string;
  notes?: string;
  uploadedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoanHistoryEntry {
  id: string;
  userId: string;
  userName: string;
  userRole?: string;
  userDepartment?: string;
  userPhone?: string;
  stageName: string;
  timestamp: string; // ISO date string
  notes?: string;
  requiredFulfilment?: string;
  fulfillmentNotes?: string;
  isFulfilled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoanRequest {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerBranch?: string;
  loanAmount: number;
  sectorId: string;
  sectorName: string;
  parentSectorId?: string;
  parentSectorName?: string;
  requestTypeId: string;
  requestTypeName: string;
  loanPurpose: string;

  workflowVersionId?: string; 
  currentStageId?: string;
  currentStageStatus?: string; 

  submittedDate: string; // ISO date string
  lastUpdatedDate: string; // ISO date string
  stageEntryDate?: string; // ISO date string

  assignedDepartmentId?: string;
  assignedDepartment?: string;
  
  assignedToUsers: User[]; // Now an array for multiple assignees
  stageCompletedBy: User[]; // Users who have marked this stage as complete

  assignedById?: string; // ID of the user who assigned the staff

  documents: LoanDocument[];
  history: LoanHistoryEntry[];

  stageDeadline?: string; // ISO date string
  isUrgent: boolean;
  isOverdue?: boolean;
  isReadyForManagerReview?: boolean;

  currentStageName?: string;
  currentStageOrder?: number;
  isTerminalStage?: boolean;
  progressPercentage?: number;

  createdById?: string; // Added to track submission origin
  createdBy?: User; // Creator object populated for rich UI display

  // Type 2 Enhancements
  submissionType?: 'TYPE1' | 'TYPE2';
  lafStatus?: 'PENDING' | 'COMPLETED' | 'EXPORTED';
  lafData?: any;
  pvrData?: any;
  customerSummaryData?: any;
  valuationReportData?: any;
  isReadyForValuation?: boolean;
  isValuationCompleted?: boolean;
  committeeDecisions: {
    id: string;
    decision: 'APPROVE' | 'REJECT';
    comment?: string;
    member: {
      id: string;
      name: string;
    };
  }[];

  createdAt?: string;
  updatedAt?: string;
}

export interface ActiveWorkflow {
  id: string; // The ID of the workflow *version*
  name: string; // A combined name, e.g., "Standard Personal Loan (v2)"
  sectorName: string;
  departmentName: string;
}
