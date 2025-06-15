/*
  Warnings:

  - You are about to alter the column `loanAmount` on the `LoanRequest` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `Decimal(12,2)`.
  - Made the column `stageEntryDate` on table `LoanRequest` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `WorkflowStageDefinition` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `WorkflowVersion` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "LoanRequest" DROP CONSTRAINT "LoanRequest_currentStageIdMirror_fkey";

-- DropForeignKey
ALTER TABLE "LoanRequest" DROP CONSTRAINT "LoanRequest_workflowVersionIdMirror_fkey";

-- DropIndex
DROP INDEX "LoanRequest_assignedToUserId_idx";

-- DropIndex
DROP INDEX "LoanRequest_currentStageIdMirror_idx";

-- DropIndex
DROP INDEX "LoanRequest_isOverdue_idx";

-- DropIndex
DROP INDEX "LoanRequest_isReadyForManagerReview_idx";

-- DropIndex
DROP INDEX "LoanRequest_loanType_idx";

-- DropIndex
DROP INDEX "WorkflowVersion_isActive_idx";

-- AlterTable
ALTER TABLE "LoanDocument" ADD COLUMN     "filePath" TEXT;

-- AlterTable
ALTER TABLE "LoanRequest" ALTER COLUMN "loanAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "submittedDate" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "stageEntryDate" SET NOT NULL,
ALTER COLUMN "stageEntryDate" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "WorkflowStageDefinition" ALTER COLUMN "requiredDocumentNames" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "WorkflowVersion" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "LoanRequest" ADD CONSTRAINT "LoanRequest_currentStageIdMirror_fkey" FOREIGN KEY ("currentStageIdMirror") REFERENCES "WorkflowStageDefinition"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LoanRequest" ADD CONSTRAINT "LoanRequest_workflowVersionIdMirror_fkey" FOREIGN KEY ("workflowVersionIdMirror") REFERENCES "WorkflowVersion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
