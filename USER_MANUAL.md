
# LoanFlow: User Manual

## 1. Introduction

Welcome to LoanFlow, your comprehensive solution for managing the entire loan origination lifecycle. This manual will guide you through the key features of the application, from creating a new loan request to managing workflows and user roles.

---

## 2. Getting Started: Logging In & The Dashboard

### 2.1. Logging In
To access the system, use the credentials provided by your administrator.
- **Username:** Your 10-digit phone number (e.g., `0912345678`).
- **Password:** Your assigned password.

On first login, you will be required to change your temporary password for security.

### 2.2. The Dashboard
The Dashboard is your central hub. It provides a high-level overview of the loan pipeline with key statistics:
- **Active Loans:** Total number of loans currently being processed.
- **New Applications:** Loans submitted in the last 7 days.
- **Approval Rate:** The percentage of completed loans that were approved.
- **Overdue Tasks:** A critical indicator of loans that have passed their stage deadline. Clicking this card takes you directly to the Overdue Tasks report.

---

## 3. Core Features & Workflows

### 3.1. Creating a New Loan Request
Users with the `CREATE_LOAN_REQUEST` permission can initiate new applications.
1.  Navigate to **New Loan Request** from the sidebar or dashboard.
2.  Fill in all required fields for customer and loan details.
3.  Select the appropriate **Child Sector** (e.g., 'Manufacturing Industry'). The system will automatically determine the correct workflow path based on its parent sector (e.g., 'Manufacturing & Agriculture Sector').
4.  Review all details in the confirmation dialog before final submission.

### 3.2. The Loan Pipeline
The **Loan Pipeline** is a Kanban-style board that visualizes all active loans, organized by workflow and stage.
- **Filter & Search:** Use the filters to view loans by status (Active, Overdue, Terminated) or search for specific loans by number, customer name, or sector.
- **Loan Cards:** Each card represents a loan and displays key information like customer name, loan number, sector, and urgency status.
- **View Details:** Click the "View" button on a card to navigate to the detailed Loan Request page.

### 3.3. Loan Request Detail Page
This is the central page for managing a specific loan. Your available actions depend on your permissions.

**Key Sections:**
- **Header:** Contains primary action buttons like **Approve & Promote**, **Return for Rework**, **Add Note**, and **Assign Staff**.
- **Progress Display:** Shows the loan's overall progress and the current stage deadline.
- **Loan Info:** Displays core details like loan amount, purpose, customer contacts, and assigned staff.
- **Documents:** Manage documents for the current stage. You can upload files or check off requirements. Staff with `VERIFY_LOAN_DOCUMENTS` permission can verify submitted files.
- **History & Timeline:** A complete, time-stamped log of every action taken on the loan.

**Common Actions:**
- **Mark Stage Complete:** Assigned staff click this to submit their work for managerial review.
- **Approve & Promote:** Managers use this to move the loan to the next stage in the workflow.
- **Return for Rework:** Managers can send a loan back to the assigned staff with a note explaining what needs to be corrected.

### 3.4. My Assigned Cases
If you are a Loan Officer or other processing staff, this page lists all loan requests that are currently assigned to you for action. It is your primary work queue.

### 3.5. Manager Review Queue
Managers use this page to see all loans within their department that have been marked as complete by staff and are awaiting review. From here, a manager can review the details and either promote the loan or return it for rework.

### 3.6. Unassigned Cases (Department Queue)
When a loan enters a new workflow or stage, it is placed in the **Unassigned Cases** queue for the responsible department. Department managers use this page to assign these new cases to specific staff members.

---

## 4. Reporting & Lookups

### 4.1. Task Assignment Report
Found under **Reports**, this page provides a detailed, filterable, and sortable table of all loan tasks. It's useful for tracking workload, identifying bottlenecks, and generating CSV exports.

### 4.2. Overdue Tasks
This report isolates all loans that have passed their stage deadline, allowing managers to prioritize follow-ups and address delays.

### 4.3. Customer Management
The **Customers** page lists all customers in the system. Clicking a customer provides a profile view with their contact information and a complete history of all associated loan requests.

### 4.4. Public Loan Tracker
The **Public Loan Tracker** provides a simplified, external-facing view of a loan's progress. Customers can enter their Loan ID to see which stage their application is in without needing to log into the main system.

---

## 5. Settings (For Administrators)

The **Settings** area is restricted to users with administrative permissions.

### 5.1. Workflow Definitions
This is the most critical part of the system configuration. Here, administrators can:
- **Define Workflow Paths:** Group workflows under a **Parent Sector** (e.g., 'Service & Mining Sectors').
- **Create Workflow Definitions:** Build the sequence of workflows for a path (e.g., Valuation -> Appraisal -> Disbursement).
- **Manage Versions:** Each workflow definition can have multiple versions. Only one version can be **active** at a time.
- **Configure Stages:** Within a version, define the individual stages, set their timeline, assign a responsible department, and specify mandatory document requirements.

### 5.2. Role Management
Create and manage user roles (e.g., "CRM," "Director," "Loan Officer"). For each role, you can assign granular permissions that control what users can see and do within the application.

### 5.3. User Management
- **Register New User:** Manually create new user accounts with a temporary password.
- **Manage User Assignments:** Assign existing users to a specific **Department** and **Role**. This is a crucial step to ensure users have the correct access and appear in assignment lists.

### 5.4. Manage Departments, Branches, & Districts
These sections allow you to define the organizational structure used throughout the application, from workflow assignments to customer profiles.
