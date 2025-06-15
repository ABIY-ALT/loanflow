/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "WorkflowStageDefinition_workflowVersionId_name_key";

-- DropIndex
DROP INDEX "WorkflowStageDefinition_workflowVersionId_order_key";

-- AlterTable
ALTER TABLE "LoanRequest" ALTER COLUMN "loanAmount" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "submittedDate" DROP DEFAULT,
ALTER COLUMN "stageEntryDate" DROP NOT NULL,
ALTER COLUMN "stageEntryDate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "permissions" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkflowStageDefinition" ALTER COLUMN "percentageWeight" SET DEFAULT 0,
ALTER COLUMN "percentageWeight" SET DATA TYPE DOUBLE PRECISION;

-- DropEnum
DROP TYPE "UserRole";

-- CreateIndex
CREATE INDEX "LoanDocument_loanRequestId_idx" ON "LoanDocument"("loanRequestId");

-- CreateIndex
CREATE INDEX "LoanHistoryEntry_loanRequestId_idx" ON "LoanHistoryEntry"("loanRequestId");

-- CreateIndex
CREATE INDEX "LoanHistoryEntry_userId_idx" ON "LoanHistoryEntry"("userId");

-- CreateIndex
CREATE INDEX "LoanRequest_assignedToUserId_idx" ON "LoanRequest"("assignedToUserId");

-- CreateIndex
CREATE INDEX "LoanRequest_loanType_idx" ON "LoanRequest"("loanType");

-- CreateIndex
CREATE INDEX "LoanRequest_workflowDefinitionIdMirror_idx" ON "LoanRequest"("workflowDefinitionIdMirror");

-- CreateIndex
CREATE INDEX "LoanRequest_workflowVersionIdMirror_idx" ON "LoanRequest"("workflowVersionIdMirror");

-- CreateIndex
CREATE INDEX "LoanRequest_currentStageIdMirror_idx" ON "LoanRequest"("currentStageIdMirror");

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE INDEX "WorkflowStageDefinition_workflowVersionId_idx" ON "WorkflowStageDefinition"("workflowVersionId");

-- CreateIndex
CREATE INDEX "WorkflowStageDefinition_responsibleDepartmentId_idx" ON "WorkflowStageDefinition"("responsibleDepartmentId");

-- CreateIndex
CREATE INDEX "WorkflowVersion_workflowDefinitionId_idx" ON "WorkflowVersion"("workflowDefinitionId");

-- RenameForeignKey
ALTER TABLE "LoanRequest" RENAME CONSTRAINT "LoanRequest_currentStageIdMirror_fkey" TO "fk_loan_current_stage_mirror";

-- RenameForeignKey
ALTER TABLE "LoanRequest" RENAME CONSTRAINT "LoanRequest_workflowVersionIdMirror_fkey" TO "fk_loan_workflow_ver_mirror";
