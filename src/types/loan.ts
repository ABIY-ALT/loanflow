
export enum LoanStage {
  APPLICATION_SUBMITTED = "Application Submitted",
  DOCUMENT_COLLECTION = "Document Collection",
  UNDER_REVIEW = "Under Review",
  ADDITIONAL_INFO_REQUIRED = "Additional Info Required",
  APPROVED = "Approved",
  REJECTED = "Rejected",
  FUNDS_DISBURSED = "Funds Disbursed",
}

export interface LoanDocument {
  id: string;
  name: string;
  status: "Pending" | "Submitted" | "Verified" | "Rejected";
  notes?: string;
}

export interface LoanHistoryEntry {
  id: string;
  stage: LoanStage;
  timestamp: string; // ISO date string
  userId: string; // ID of the bank user (could be system or a specific user)
  userName: string;
  notes?: string;
  requiredFulfilment?: string; // Description of what the customer needs to fulfill
}

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
}

export interface LoanRequest {
  id: string;
  loanNumber: string;
  customerNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  loanAmount: number;
  loanType: string; // e.g., "Personal", "Mortgage", "Auto"
  loanPurpose: string;
  currentStage: LoanStage;
  submittedDate: string; // ISO date string
  lastUpdatedDate: string; // ISO date string
  assignedTo?: string; // User ID of the assigned Relationship Manager
  documents: LoanDocument[];
  history: LoanHistoryEntry[];
  stageDeadline?: string; // ISO date string, for current stage
  isOverdue?: boolean;
  isReadyForManagerReview?: boolean; // New field
}

export const loanStages: LoanStage[] = [
  LoanStage.APPLICATION_SUBMITTED,
  LoanStage.DOCUMENT_COLLECTION,
  LoanStage.UNDER_REVIEW,
  LoanStage.ADDITIONAL_INFO_REQUIRED,
  LoanStage.APPROVED,
  LoanStage.REJECTED,
  LoanStage.FUNDS_DISBURSED,
];

