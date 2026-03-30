-- AlterTable: Add allowedRoles and requiresApproval to WorkflowStageDefinition
ALTER TABLE "WorkflowStageDefinition" ADD COLUMN IF NOT EXISTS "allowedRoles" TEXT;
ALTER TABLE "WorkflowStageDefinition" ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: CaseReviewHistory
CREATE TABLE "CaseReviewHistory" (
    "id" TEXT NOT NULL,
    "loanRequestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseReviewHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CaseReviewHistory" ADD CONSTRAINT "CaseReviewHistory_loanRequestId_fkey" FOREIGN KEY ("loanRequestId") REFERENCES "LoanRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseReviewHistory" ADD CONSTRAINT "CaseReviewHistory_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
