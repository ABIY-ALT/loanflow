
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

## 3. The Loan Pipeline

The **Loan Pipeline** is a powerful, Kanban-style board that gives you a complete visual overview of all active loans. Loans are organized by their parent sector (e.g., 'Manufacturing & Agriculture Sector'), workflow, and current stage, allowing you to see exactly where every application stands in the process.

- **Filter & Search:** Use the powerful filters at the top of the page to instantly narrow down the view. You can filter by status (Active, Overdue, Terminated) or use the search bar to find specific loans by number, customer name, or sector.
- **Loan Cards:** Each card on the board represents a single loan. It displays critical information at a glance, including the customer's name, loan number, sector, and whether the case is marked as urgent.
- **View Details:** To manage or review a specific loan, simply click the "View" button on its card. This will take you to the detailed Loan Request page, where you can take further action.

This page is the primary tool for tracking the flow of all loans through the system.

---

## 4. Creating a New Loan Request

To initiate a new loan application, navigate to the **"New Loan Request"** page from the sidebar or click the button on the Dashboard or Loan Pipeline pages. This opens a comprehensive form to capture all necessary initial information.

- **Customer Information:** Fill in the customer's full name, email, phone number, and their home branch. If a customer with the provided email already exists, this loan will be added to their existing profile; otherwise, a new customer profile will be created.
- **Loan Details:** Enter the requested loan amount, select the appropriate **Child Sector** (e.g., 'Agriculture', 'Hotel and Tourism'), and choose the **Request Type** (e.g., 'New Loan').
- **Workflow Routing:** Based on the **Child Sector** you select, the system will automatically display which **Parent Sector** and **Initial Department** the loan will be routed to. This ensures the request enters the correct workflow from the start.
- **Loan Purpose:** Provide a clear and concise description of why the customer is requesting the loan.
- **Submission:** After filling out all fields, click **"Submit Loan Request."** A confirmation dialog will appear, allowing you to review all the details one last time. Click **"Confirm & Submit"** to create the loan and send it to the initial department for assignment.

---

## 5. Managing Customers

The LoanFlow system maintains a comprehensive profile for every customer, allowing you to easily track their complete history with the institution.

### 5.1. The Customer List
You can access a complete list of all customers by navigating to the **"Customers"** page from the sidebar. This page provides a high-level overview of every customer in the system.

- **Search & Filter:** Use the search bar at the top of the list to instantly find a customer by their name, email address, or phone number.
- **Customer Overview:** The table displays each customer's name, contact details, the current status of their most recent loan, and the total number of loan requests they have made.

### 5.2. Customer Profile Page
To see a detailed view of a customer, click the **"View Profile"** button next to their name in the customer list. The profile page contains two main sections:

- **Contact Information:** Displays the customer's email, phone number, and home branch for quick reference.
- **Loan Requests:** A complete table of every loan request associated with that customer, including the loan number, amount, submission date, and current stage. You can click the "View Loan" button on any entry in this table to go directly to that specific loan's detail page.

This feature provides a 360-degree view of the customer's relationship and history with the bank.

---

## 6. My Assigned Cases

This page provides a personalized view of all loan requests that are currently assigned directly to you for processing. It is your primary work queue, showing you exactly which tasks require your attention.

- **Prioritized List:** The table automatically sorts your tasks to help you prioritize. Urgent cases and overdue tasks are always listed first.
- **Key Information:** For each assigned case, you can see the customer's name, loan number, the current stage it's in, and its deadline.
- **Process Your Tasks:** To begin working on a loan, click the **"View & Process"** button. This will take you to the detailed loan page where you can review information, upload documents, and mark your tasks as complete to move the loan forward.

---

## 7. Manager Review Queue

This page is designed specifically for users in managerial roles, such as Directors and Division Managers. It serves as the central hub for reviewing loan requests that have been fully processed by assigned staff and are now awaiting a manager's decision.

- **Review Queue:** The page lists all loans within your department that are marked as "Ready for Review." It prioritizes urgent and overdue cases so you can address critical items first.
- **Case Information:** For each loan, you can quickly see the customer's name, loan number, current stage, and the staff members who worked on it.
- **Take Action:** To make a decision, click the **"Review & Process"** button. This takes you to the loan's detail page, where you have two primary options:
    - **Approve & Promote:** If the work is satisfactory, you can promote the loan to the next stage in its workflow.
    - **Return for Rework:** If you find issues or missing information, you can return the case to the assigned staff with a note explaining the required corrections.

---

## 8. Unassigned Cases Queue

The **Unassigned Cases Queue** is a crucial page for department managers. It lists all loan requests that have been routed to your department but have not yet been assigned to a specific staff member for processing.

- **Assignment Hub:** This page acts as the central hub for incoming work for your department. It's your responsibility to assign these cases to your team members.
- **Case Details:** For each unassigned case, you can see the customer's name, loan number, the current stage, and the date it was last updated. Urgent cases are flagged for immediate attention.
- **Assign Staff:** To assign a loan, click the **"View & Assign Staff"** button. This will take you to the loan's detail page, where you can use the "Edit / Assign" functionality to delegate the task to one or more members of your team.

This queue ensures that no loan request sits idle and that work is distributed efficiently within each department.

---

## 9. Internal Status Lookup

The **Internal Status Lookup** page is a quick and powerful search tool for finding specific loan requests within the system. This is especially useful when you have a specific piece of information, like a loan number, and need to quickly access the corresponding loan record.

- **Accessing the Page:** You can find the "Internal Status Lookup" in the sidebar.
- **Search Criteria:** The page provides a simple form where you can enter a search term.
- **Identifier Type:** You must specify what type of information you are searching for by selecting one of the following buttons:
    - **Loan Number:** Search for a loan using its unique ID (e.g., `LN-PSQL-123456`).
    - **Customer Name:** Find all loans associated with a customer's name.
    - **Customer Code:** Search using the customer's unique identifier code.
- **Viewing Results:** After searching, the system will display a table with all matching loan requests. From this table, you can click "View Loan" to navigate directly to the detailed page for any of the results.

This feature is designed for internal staff to quickly find and access loan information without needing to browse the entire pipeline.

---

### 10. Public Loan Tracker

The Public Loan Tracker is a feature designed for loan applicants to check the status of their application without needing to log into the main system. It provides a simplified, read-only view of their loan's progress.

*   **Accessing the Tracker:** Customers can access the tracker via a public URL (e.g., `yourapp.com/track-loan`).
*   **Searching for a Loan:** On the tracker page, the applicant must enter the unique **Loan ID** that was provided to them when they submitted their application (e.g., `LN-PSQL-123456`).
*   **Viewing the Status:** After submitting the Loan ID, the page will display:
    *   **Applicant and Loan Details:** The customer's name and loan number.
    *   **Estimated Timeline:** The total estimated processing time for the entire loan workflow.
    *   **Workflow Stepper:** A visual stepper that shows all the stages in the loan's path.
        *   **Completed:** Stages marked with a check are finished.
        *   **Current Stage:** The stage currently being processed is highlighted.
        *   **Pending:** Future stages are shown as pending.
    *   **Stage Information:** For each stage, the customer can see the responsible department and the estimated timeline for that specific stage.

This feature enhances transparency by allowing customers to self-serve and monitor their application's progress through the pipeline.
