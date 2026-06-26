import type { LoanRequest } from '@/types/loan';

export type ValuationQueueStatus =
  | 'PENDING' // With Director, awaiting routing to a Maker Manager
  | 'ASSIGNED_TO_MANAGER' // With Maker Manager, awaiting assignment to a Maker Officer
  | 'ASSIGNED_TO_OFFICER' // With Maker Officer, performing valuation
  | 'ASSIGNED_TO_CHECKER_MANAGER' // With Checker Manager, awaiting assignment to a Checker Officer
  | 'ASSIGNED_TO_CHECKER_OFFICER' // With Checker Officer, performing verification
  | 'PENDING_CHECKER_REVIEW' // With Checker Manager, final review of the verification
  | 'PENDING_FINALIZATION' // With Maker Manager, finalizing the valuation (loan amount <= threshold)
  | 'PENDING_DIRECTOR_FINALIZATION' // With Valuation Director, finalizing the valuation (loan amount > threshold)
  | 'COMPLETED' // Valuation complete, case returned to CRM / next workflow
  // Retired statuses (kept for backward-compat with any in-flight rows):
  | 'PENDING_MANAGER_REVIEW'
  | 'PENDING_DIRECTOR_REVIEW'
  | string;

/** Queue statuses that represent an active assignment to a specific user. */
export const ACTIVE_ASSIGNMENT_STATUSES = [
  'ASSIGNED_TO_MANAGER',
  'ASSIGNED_TO_OFFICER',
  'ASSIGNED_TO_CHECKER_MANAGER',
  'ASSIGNED_TO_CHECKER_OFFICER',
] as const;

export interface ValuationAssignee {
  id: string;
  name: string;
  customRole?: {
    name: string;
  } | null;
}

export interface ValuationQueueItem {
  id: string;
  loanRequestId: string;
  status: ValuationQueueStatus;
  routingOption?: 'MANAGER' | 'OFFICER' | null;
  makerId?: string | null;
  makerOfficerId?: string | null;
  makerOfficer?: ValuationAssignee | null;
  assignedToId?: string | null;
  assignedTo?: ValuationAssignee | null;
  isCheckedByChecker?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  loanRequest: LoanRequest;
}

export interface ValuationStaff {
  id: string;
  name: string;
  customRole?: {
    name: string;
  } | null;
  valuationAssignments: Array<{ id: string }>;
}

export type ValuationResult<T> = { error: string } | T;
