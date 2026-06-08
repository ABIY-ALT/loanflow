-- Speeds up the "one active case per customer + department" duplicate guard
-- (findActiveCaseForCustomerDepartment / guardActiveCasePerCustomerDepartment).
-- Non-unique: safe to apply even while historical duplicates still exist.
CREATE INDEX "LoanRequest_customerId_assignedDepartmentId_isTerminalStage_idx" ON "LoanRequest"("customerId", "assignedDepartmentId", "isTerminalStage");
