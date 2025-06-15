/*
  Warnings:

  - A unique constraint covering the columns `[workflowVersionId,name]` on the table `WorkflowStageDefinition` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "LoanRequest" DROP CONSTRAINT "LoanRequest_workflowDefinitionIdMirror_fkey";

-- DropIndex
DROP INDEX "LoanDocument_loanRequestId_idx";

-- DropIndex
DROP INDEX "LoanHistoryEntry_loanRequestId_idx";

-- DropIndex
DROP INDEX "LoanHistoryEntry_userId_idx";

-- DropIndex
DROP INDEX "LoanRequest_workflowVersionIdMirror_idx";

-- DropIndex
DROP INDEX "WorkflowStageDefinition_workflowVersionId_idx";

-- DropIndex
DROP INDEX "WorkflowVersion_workflowDefinitionId_isActive_idx";

-- AlterTable
ALTER TABLE "LoanHistoryEntry" ALTER COLUMN "timestamp" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LoanRequest" ALTER COLUMN "loanAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "submittedDate" DROP DEFAULT,
ALTER COLUMN "stageEntryDate" DROP NOT NULL,
ALTER COLUMN "stageEntryDate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowStageDefinition" ALTER COLUMN "requiredDocumentNames" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "updatedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkflowVersion" ALTER COLUMN "updatedAt" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "LoanRequest_loanType_idx" ON "LoanRequest"("loanType");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStageDefinition_workflowVersionId_name_key" ON "WorkflowStageDefinition"("workflowVersionId", "name");

-- CreateIndex
CREATE INDEX "WorkflowVersion_isActive_idx" ON "WorkflowVersion"("isActive");

-- AddForeignKey
ALTER TABLE "LoanHistoryEntry" ADD CONSTRAINT "LoanHistoryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
