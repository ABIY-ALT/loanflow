

import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, DocumentRequirement } from '@/types/loan';
import { DocumentRequirementType } from '@/types/loan';

// UserRole enum is removed from types/loan.ts, so it should not be imported or used here.
// We will assign custom role names directly in the mock user data if needed.

const MOCK_REFERENCE_DATE = new Date('2024-07-15T10:00:00.000Z').getTime();

// App-level User type for mocks (no longer uses UserRole enum)
interface MockAppUser {
  id: string; // This will be Prisma's User ID
  userId?: string; // This would be the ID from Identity Server if syncing
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  department?: Department;
  customRoleName?: string; // Assign custom role by name
}


export const mockUsers: MockAppUser[] = [
  { 
    id: 'user-loan-officer', 
    userId: 'identity-loan-officer', 
    name: 'Alex Officer', 
    email: 'alex.officer@loanflow.app', 
    customRoleName: "Loan Officer", 
    department: "Origination", 
    firstName: 'Alex', 
    lastName: 'Officer', 
    phoneNumber: '0911111111' 
  },
  { 
    id: 'user-admin', 
    userId: 'identity-admin', 
    name: 'Sam Admin', 
    email: 'sam.admin@loanflow.app', 
    customRoleName: "Administrator", 
    department: "Compliance", 
    firstName: 'Sam', 
    lastName: 'Admin', 
    phoneNumber: '0922222222' 
  },
];

export const mockDepartments: Department[] = [
  "Origination",
  "Underwriting",
  "Credit Analysis",
  "Closing",
  "Compliance",
  "Servicing"
];

const createDocReq = (id: string, name: string, isMandatory: boolean, type: DocumentRequirementType): DocumentRequirement => ({
  id,
  name,
  isMandatory,
  type,
});

// This file is now largely superseded by the Prisma seed script.
// The workflow and loan request mock data is kept for reference or potential future use in non-DB environments, but it is not actively used by the application which now relies on the database.
// The primary exports used by the seeding process are mockUsers and mockDepartments.
