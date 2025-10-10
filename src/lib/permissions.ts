
// src/lib/permissions.ts

// Using 'as const' makes the values of PERMISSIONS literal types,
// and AppPermission becomes a union of these literal string types.
export const PERMISSIONS = {
  // General Access
  VIEW_DASHBOARD: "VIEW_DASHBOARD",
  VIEW_LOAN_PIPELINE: "VIEW_LOAN_PIPELINE",
  VIEW_LOAN_DETAILS: "VIEW_LOAN_DETAILS", // Generic view for any loan
  VIEW_LOAN_STATUS_LOOKUP: "VIEW_LOAN_STATUS_LOOKUP",

  // Loan Creation & Officer Actions
  CREATE_LOAN_REQUEST: "CREATE_LOAN_REQUEST",
  VIEW_OWN_ASSIGNED_CASES: "VIEW_OWN_ASSIGNED_CASES", // Specific to logged-in user
  EDIT_LOAN_DETAILS: "EDIT_LOAN_DETAILS", // Can edit core loan data
  ASSIGN_LOAN_TO_STAFF: "ASSIGN_LOAN_TO_STAFF", // Can assign/reassign staff
  ADD_LOAN_NOTES: "ADD_LOAN_NOTES",
  LOG_INFO_REQUEST: "LOG_INFO_REQUEST",
  FULFILL_INFO_REQUEST: "FULFILL_INFO_REQUEST",
  UPLOAD_LOAN_DOCUMENTS: "UPLOAD_LOAN_DOCUMENTS",
  VERIFY_LOAN_DOCUMENTS: "VERIFY_LOAN_DOCUMENTS",
  MARK_STAGE_COMPLETE: "MARK_STAGE_COMPLETE", // Staff action to submit for review

  // Managerial Actions
  VIEW_MANAGER_REVIEW_QUEUE: "VIEW_MANAGER_REVIEW_QUEUE",
  VIEW_UNASSIGNED_CASES_QUEUE: "VIEW_UNASSIGNED_CASES_QUEUE", // Department queue
  PROMOTE_LOAN_STAGE: "PROMOTE_LOAN_STAGE", // Manager approval
  RETURN_LOAN_FOR_REWORK: "RETURN_LOAN_FOR_REWORK", // Manager action
  VIEW_OVERDUE_TASKS_REPORT: "VIEW_OVERDUE_TASKS_REPORT", // Overdue tasks page

  // Settings & Administration
  MANAGE_SETTINGS_WORKFLOWS: "MANAGE_SETTINGS_WORKFLOWS",
  MANAGE_SETTINGS_DEPARTMENTS: "MANAGE_SETTINGS_DEPARTMENTS",
  MANAGE_SETTINGS_ROLES: "MANAGE_SETTINGS_ROLES", // Manage roles and their permissions
  MANAGE_USERS: "MANAGE_USERS", // Future: For user creation, role assignment etc.
  VIEW_SYSTEM_AUDIT_LOGS: "VIEW_SYSTEM_AUDIT_LOGS", // Future: For system logs
} as const;

// Create a type from the keys of PERMISSIONS
export type AppPermission = keyof typeof PERMISSIONS;

// Create an array of all permission keys
export const ALL_PERMISSIONS: AppPermission[] = Object.keys(
  PERMISSIONS
) as AppPermission[];

export const PERMISSION_DESCRIPTIONS: Record<AppPermission, string> = {
  VIEW_DASHBOARD: "Can view the main application dashboard.",
  VIEW_LOAN_PIPELINE: "Can view the loan Kanban board and loan cards.",
  VIEW_LOAN_DETAILS: "Can view the detailed information page for any loan.",
  VIEW_LOAN_STATUS_LOOKUP: "Can use the AI loan status lookup tool.",
  CREATE_LOAN_REQUEST: "Can submit new loan requests into the system.",
  VIEW_OWN_ASSIGNED_CASES: "Can view the 'My Assigned Cases' page (cases assigned to them).",
  EDIT_LOAN_DETAILS: "Can edit loan details and customer information.",
  ASSIGN_LOAN_TO_STAFF: "Can assign or re-assign a loan to a specific staff member.",
  ADD_LOAN_NOTES: "Can add notes to a loan's history.",
  LOG_INFO_REQUEST: "Can log a request for additional information on a loan.",
  FULFILL_INFO_REQUEST: "Can mark an information request as fulfilled.",
  UPLOAD_LOAN_DOCUMENTS: "Can upload documents related to a loan.",
  VERIFY_LOAN_DOCUMENTS: "Can mark uploaded loan documents as 'Verified'.",
  MARK_STAGE_COMPLETE: "Can mark a loan stage as complete (typically by assigned staff, submitting for manager review).",
  VIEW_MANAGER_REVIEW_QUEUE: "Can view the queue of loans awaiting manager review.",
  VIEW_UNASSIGNED_CASES_QUEUE: "Can view the queue of unassigned cases within departments (department queue).",
  PROMOTE_LOAN_STAGE: "Can approve a loan stage and promote it to the next stage in the workflow (manager action).",
  RETURN_LOAN_FOR_REWORK: "Can return a loan to a previous assignee or state for rework (manager action).",
  VIEW_OVERDUE_TASKS_REPORT: "Can view the page listing all overdue loan tasks.",
  MANAGE_SETTINGS_WORKFLOWS: "Can access settings to define and manage loan workflow definitions and versions.",
  MANAGE_SETTINGS_DEPARTMENTS: "Can access settings to create, edit, and delete departments.",
  MANAGE_SETTINGS_ROLES: "Can access settings to create, edit, and delete roles and assign permissions to them.",
  MANAGE_USERS: "Future: Can manage user accounts, assign roles, and reset passwords.",
  VIEW_SYSTEM_AUDIT_LOGS: "Future: Can view system-wide audit logs for important actions.",
};

// Helper to group permissions for easier display in UI
export const PERMISSION_CATEGORIES: { name: string; permissions: AppPermission[] }[] = [
  {
    name: "General Access & Viewing",
    permissions: [
      "VIEW_DASHBOARD",
      "VIEW_LOAN_PIPELINE",
      "VIEW_LOAN_DETAILS",
      "VIEW_LOAN_STATUS_LOOKUP",
    ],
  },
  {
    name: "Loan Processing & Officer Actions",
    permissions: [
      "CREATE_LOAN_REQUEST",
      "VIEW_OWN_ASSIGNED_CASES",
      "EDIT_LOAN_DETAILS",
      "ASSIGN_LOAN_TO_STAFF",
      "ADD_LOAN_NOTES",
      "LOG_INFO_REQUEST",
      "FULFILL_INFO_REQUEST",
      "UPLOAD_LOAN_DOCUMENTS",
      "VERIFY_LOAN_DOCUMENTS",
      "MARK_STAGE_COMPLETE",
    ],
  },
  {
    name: "Managerial & Supervisory Actions",
    permissions: [
      "VIEW_MANAGER_REVIEW_QUEUE",
      "VIEW_UNASSIGNED_CASES_QUEUE",
      "PROMOTE_LOAN_STAGE",
      "RETURN_LOAN_FOR_REWORK",
      "VIEW_OVERDUE_TASKS_REPORT",
    ],
  },
  {
    name: "System Administration & Settings",
    permissions: [
      "MANAGE_SETTINGS_WORKFLOWS",
      "MANAGE_SETTINGS_DEPARTMENTS",
      "MANAGE_SETTINGS_ROLES",
      "MANAGE_USERS",
      "VIEW_SYSTEM_AUDIT_LOGS",
    ],
  },
];
