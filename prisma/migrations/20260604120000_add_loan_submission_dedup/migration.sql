-- CreateTable
CREATE TABLE "LoanSubmissionDedup" (
    "dedupKey" TEXT NOT NULL,
    "loanRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanSubmissionDedup_pkey" PRIMARY KEY ("dedupKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanSubmissionDedup_loanRequestId_key" ON "LoanSubmissionDedup"("loanRequestId");

-- CreateIndex
CREATE INDEX "LoanSubmissionDedup_createdAt_idx" ON "LoanSubmissionDedup"("createdAt");

-- AddForeignKey
ALTER TABLE "LoanSubmissionDedup" ADD CONSTRAINT "LoanSubmissionDedup_loanRequestId_fkey" FOREIGN KEY ("loanRequestId") REFERENCES "LoanRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
