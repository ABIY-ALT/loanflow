// src/lib/permissions.ts

// Using 'as const' makes the values of PERMISSIONS literal types,
// and AppPermission becomes a union of these literal string types.
export const PERMISSIONS = {
  // General Access
  VIEW_DASHBOARD: "VIEW_DASHBOARD",
  VIEW_EXECUTIVE_OVERVIEW: "VIEW_EXECUTIVE_OVERVIEW",
  VIEW_LOAN_PIPELINE: "VIEW_LOAN_PIPELINE",
  VIEW_LOAN_DETAILS: "VIEW_LOAN_DETAILS", // Generic view for any loan
  VIEW_LOAN_STATUS_LOOKUP: "VIEW_LOAN_STATUS_LOOKUP",
  VIEW_CUSTOMERS: "VIEW_CUSTOMERS",

  // Loan Creation & Officer Actions
  CREATE_LOAN_REQUEST: "CREATE_LOAN_REQUEST",
  VIEW_OWN_ASSIGNED_CASES: "VIEW_OWN_ASSIGNED_CASES", // My Workspace — general assigned cases
  VIEW_MY_VALUATION_CASES: "VIEW_MY_VALUATION_CASES", // District Valuation — My Valuation page
  VIEW_DISTRICT_ANALYST_REVIEW: "VIEW_DISTRICT_ANALYST_REVIEW", // District Workflow — Analyst Review page
  DISTRIBUTE_TO_DISTRICT_APPROVAL: "DISTRIBUTE_TO_DISTRICT_APPROVAL", // District analyst — distribute to Committee Approval
  VIEW_OWN_SUBMITTED_CASES: "VIEW_OWN_SUBMITTED_CASES", // Visibility for inputters/creators
  EDIT_LOAN_DETAILS: "EDIT_LOAN_DETAILS", // Can edit core loan data
  ASSIGN_LOAN_TO_STAFF: "ASSIGN_LOAN_TO_STAFF", // Can assign/reassign staff
  ADD_LOAN_NOTES: "ADD_LOAN_NOTES",
  LOG_INFO_REQUEST: "LOG_INFO_REQUEST",
  FULFILL_INFO_REQUEST: "FULFILL_INFO_REQUEST",
  UPLOAD_LOAN_DOCUMENTS: "UPLOAD_LOAN_DOCUMENTS",
  VERIFY_LOAN_DOCUMENTS: "VERIFY_LOAN_DOCUMENTS",
  MARK_STAGE_COMPLETE: "MARK_STAGE_COMPLETE", // Staff action to submit for review
  FLAG_URGENT_CASE: "FLAG_URGENT_CASE", // Can mark/unmark a loan as urgent

  // Managerial Actions
  VIEW_MANAGER_REVIEW_QUEUE: "VIEW_MANAGER_REVIEW_QUEUE",
  VIEW_MANAGER_REVIEW_HISTORY: "VIEW_MANAGER_REVIEW_HISTORY",
  VIEW_UNASSIGNED_CASES_QUEUE: "VIEW_UNASSIGNED_CASES_QUEUE", // Department queue
  VIEW_INCOMING_CASES: "VIEW_INCOMING_CASES", // New incoming cases for department heads
  PROMOTE_LOAN_STAGE: "PROMOTE_LOAN_STAGE", // Manager approval for sequential promotion
  RETURN_LOAN_FOR_REWORK: "RETURN_LOAN_FOR_REWORK", // Manager action
  APPROVE_COMMITTEE_CASES: "APPROVE_COMMITTEE_CASES", // Committee review and vote authority
  VIEW_OVERDUE_TASKS_REPORT: "VIEW_OVERDUE_TASKS_REPORT", // Overdue tasks page
  VIEW_REPORTS: "VIEW_REPORTS", // Can view the main reports page
  VIEW_DISTRICT_DASHBOARD: "VIEW_DISTRICT_DASHBOARD", // District command center analytics
  VIEW_DISTRICT_VALUATION: "VIEW_DISTRICT_VALUATION", // District valuation queue access
  
  // High-Level / Administrative Actions
  TERMINATE_LOAN_PROCESS: "TERMINATE_LOAN_PROCESS", // Can permanently stop a loan process
  MANUAL_STAGE_TRANSITION: "MANUAL_STAGE_TRANSITION", // Can move a loan to any stage in any workflow

  // Settings & Administration
  MANAGE_SETTINGS_WORKFLOWS: "MANAGE_SETTINGS_WORKFLOWS",
  MANAGE_SETTINGS_DEPARTMENTS: "MANAGE_SETTINGS_DEPARTMENTS",
  MANAGE_SETTINGS_BRANCHES: "MANAGE_SETTINGS_BRANCHES",
  MANAGE_SETTINGS_ROLES: "MANAGE_SETTINGS_ROLES", // Manage roles and their permissions
  MANAGE_USERS: "MANAGE_USERS", // For user creation, role assignment etc.
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
  VIEW_EXECUTIVE_OVERVIEW: "Can view the Executive Overview loan dashboard for senior management.",
  VIEW_LOAN_PIPELINE: "Can view the loan Kanban board and loan cards.",
  VIEW_LOAN_DETAILS: "Can view the detailed information page for any loan.",
  VIEW_LOAN_STATUS_LOOKUP: "Can use the AI loan status lookup tool.",
  VIEW_CUSTOMERS: "Can view the list of all customers.",
  CREATE_LOAN_REQUEST: "Can submit new loan requests into the system.",
  VIEW_OWN_ASSIGNED_CASES: "Can view the 'My Assigned Cases' page (cases assigned to them).",
  VIEW_MY_VALUATION_CASES: "Can view the 'My Valuation' page (valuation cases assigned to them).",
  VIEW_DISTRICT_ANALYST_REVIEW: "Can access the District Analyst Review queue.",
  DISTRIBUTE_TO_DISTRICT_APPROVAL: "Can distribute a district case to Committee Approval (district approval) after manager return or at committee distribution stage.",
  VIEW_OWN_SUBMITTED_CASES: "Can view the 'My Submitted Cases' page (cases they created).",
  EDIT_LOAN_DETAILS: "Can edit loan details and customer information.",
  ASSIGN_LOAN_TO_STAFF: "Can assign or re-assign a loan to a specific staff member.",
  ADD_LOAN_NOTES: "Can add notes to a loan's history.",
  LOG_INFO_REQUEST: "Can log a request for additional information on a loan.",
  FULFILL_INFO_REQUEST: "Can mark an information request as fulfilled.",
  UPLOAD_LOAN_DOCUMENTS: "Can upload documents related to a loan.",
  VERIFY_LOAN_DOCUMENTS: "Can mark uploaded loan documents as 'Verified'.",
  MARK_STAGE_COMPLETE: "Can mark a loan stage as complete (typically by assigned staff, submitting for manager review).",
  FLAG_URGENT_CASE: "Can mark or unmark a loan case as 'Urgent'.",
  VIEW_MANAGER_REVIEW_QUEUE: "Can view the queue of loans awaiting manager review.",
  VIEW_MANAGER_REVIEW_HISTORY: "Can view the history of manager review decisions (approvals/rejections).",
  VIEW_UNASSIGNED_CASES_QUEUE: "Can view the queue of unassigned cases within departments (department queue).",
  VIEW_INCOMING_CASES: "Can view new incoming cases promoted to their department that need staff assignment.",
  RETURN_LOAN_FOR_REWORK: "Can return a loan to the previous stage for rework.",
  PROMOTE_LOAN_STAGE: "Can approve a loan stage and promote it to the next sequential stage in the workflow.",
  APPROVE_COMMITTEE_CASES: "Can view and vote on committee approval cases.",
  VIEW_OVERDUE_TASKS_REPORT: "Can view the page listing all overdue loan tasks.",
  VIEW_REPORTS: "Can view the main reports page and its sub-reports.",
  VIEW_DISTRICT_DASHBOARD: "Can view the District Dashboard with analytics, CRM performance, and loan summaries.",
  VIEW_DISTRICT_VALUATION: "Can access the District Valuation queue and valuation review.",
  TERMINATE_LOAN_PROCESS: "Can terminate a loan process at any stage, ending all activities.",
  MANUAL_STAGE_TRANSITION: "Can manually move a loan to any stage of any workflow, overriding the standard sequence.",
  MANAGE_SETTINGS_WORKFLOWS: "Can access settings to define and manage loan workflow definitions and versions.",
  MANAGE_SETTINGS_DEPARTMENTS: "Can access settings to create, edit, and delete departments.",
  MANAGE_SETTINGS_BRANCHES: "Can access settings to create, edit, and delete branches and districts.",
  MANAGE_SETTINGS_ROLES: "Can access settings to create, edit, and delete roles and assign permissions to them.",
  MANAGE_USERS: "Can manage user accounts, assign roles, and register new users.",
  VIEW_SYSTEM_AUDIT_LOGS: "Future: Can view system-wide audit logs for important actions.",
};

/** Role UI: permission with optional sidebar-aligned label (same permission may appear in multiple groups). */
export type PermissionCategoryEntry =
  | AppPermission
  | { permission: AppPermission; label: string };

export function resolvePermissionEntry(entry: PermissionCategoryEntry): AppPermission {
  return typeof entry === "string" ? entry : entry.permission;
}

export function resolvePermissionLabel(entry: PermissionCategoryEntry): string {
  if (typeof entry === "string") {
    return PERMISSION_DESCRIPTIONS[entry] || entry;
  }
  return entry.label;
}

// Grouped for role management — mirrors sidebar navigation where applicable
export const PERMISSION_CATEGORIES: { name: string; permissions: PermissionCategoryEntry[] }[] = [
  {
    name: "Main Navigation (Sidebar)",
    permissions: [
      { permission: "VIEW_DASHBOARD", label: "Dashboard — main application dashboard" },
      { permission: "VIEW_EXECUTIVE_OVERVIEW", label: "Executive Overview — senior management loan dashboard" },
      { permission: "VIEW_LOAN_PIPELINE", label: "Loan Pipeline — Kanban board and loan cards" },
      { permission: "CREATE_LOAN_REQUEST", label: "New Loan Request — submit new loan requests" },
      { permission: "VIEW_CUSTOMERS", label: "Customers — list and profiles" },
      { permission: "VIEW_INCOMING_CASES", label: "Incoming Cases — new cases for department heads" },
      { permission: "VIEW_UNASSIGNED_CASES_QUEUE", label: "Unassigned Cases — department queue" },
    ],
  },
  {
    name: "District Workflow (Sidebar)",
    permissions: [
      { permission: "VIEW_DISTRICT_DASHBOARD", label: "District Dashboard — analytics, CRM performance, loan summaries" },
      { permission: "VIEW_DISTRICT_ANALYST_REVIEW", label: "Analyst Review — review assigned district cases" },
      { permission: "DISTRIBUTE_TO_DISTRICT_APPROVAL", label: "Distribute to District Approval — send case to Committee Approval stage" },
      { permission: "APPROVE_COMMITTEE_CASES", label: "Committee Approval — view and vote on committee cases" },
      { permission: "VIEW_MANAGER_REVIEW_QUEUE", label: "Manager Review (District) — district manager review queue" },
    ],
  },
  {
    name: "District Valuation (Sidebar)",
    permissions: [
      { permission: "VIEW_DISTRICT_VALUATION", label: "District Valuation — access valuation queues and review" },
      { permission: "VIEW_MY_VALUATION_CASES", label: "My Valuation — assigned valuation cases" },
    ],
  },
  {
    name: "My Workspace (Sidebar)",
    permissions: [
      { permission: "VIEW_OWN_ASSIGNED_CASES", label: "My Assigned Cases" },
      { permission: "VIEW_OWN_SUBMITTED_CASES", label: "My Submitted Cases" },
    ],
  },
  {
    name: "Tools & Reports (Sidebar)",
    permissions: [
      { permission: "VIEW_LOAN_STATUS_LOOKUP", label: "Internal Status Lookup — AI loan status tool" },
      { permission: "VIEW_REPORTS", label: "Reports — main reports and sub-reports" },
      { permission: "VIEW_OVERDUE_TASKS_REPORT", label: "Overdue Tasks — overdue loan tasks list" },
    ],
  },
  {
    name: "Settings (Sidebar)",
    permissions: [
      { permission: "MANAGE_SETTINGS_DEPARTMENTS", label: "Manage Departments" },
      { permission: "MANAGE_SETTINGS_BRANCHES", label: "Manage Branches & Districts" },
      { permission: "MANAGE_SETTINGS_ROLES", label: "Manage Roles" },
      { permission: "MANAGE_USERS", label: "Manage User Assignments & Register Users" },
      { permission: "MANAGE_SETTINGS_WORKFLOWS", label: "Workflow Settings (via Settings page)" },
    ],
  },
  {
    name: "Loan Processing & Officer Actions",
    permissions: [
      "VIEW_LOAN_DETAILS",
      "EDIT_LOAN_DETAILS",
      "ASSIGN_LOAN_TO_STAFF",
      "ADD_LOAN_NOTES",
      "LOG_INFO_REQUEST",
      "FULFILL_INFO_REQUEST",
      "UPLOAD_LOAN_DOCUMENTS",
      "VERIFY_LOAN_DOCUMENTS",
      "MARK_STAGE_COMPLETE",
      "FLAG_URGENT_CASE",
    ],
  },
  {
    name: "Managerial & Supervisory Actions",
    permissions: [
      "VIEW_MANAGER_REVIEW_HISTORY",
      "PROMOTE_LOAN_STAGE",
      "RETURN_LOAN_FOR_REWORK",
      "DISTRIBUTE_TO_DISTRICT_APPROVAL",
    ],
  },
  {
    name: "System Administration & High-Level Actions",
    permissions: [
      "TERMINATE_LOAN_PROCESS",
      "MANUAL_STAGE_TRANSITION",
      "VIEW_SYSTEM_AUDIT_LOGS",
    ],
  },
];
