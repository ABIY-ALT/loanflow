import type { LoanRequest } from '@/types/loan';

export type ValuationQueueStatus =
  | 'PENDING'
  | 'ASSIGNED_TO_MANAGER'
  | 'ASSIGNED_TO_OFFICER'
  | 'PENDING_MANAGER_REVIEW'
  | 'PENDING_DIRECTOR_REVIEW'
  | 'COMPLETED'
  | string;

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
