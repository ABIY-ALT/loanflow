-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RELATIONSHIP_MANAGER', 'UNDERWRITER', 'STAFF', 'VIEW_ONLY');

-- CreateEnum
CREATE TYPE "LoanDocumentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "departmentId" TEXT,
    "customRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameLowercase" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loanType" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowVersion" (
    "id" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStageDefinition" (
    "id" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "responsibleDepartmentId" TEXT NOT NULL,
    "defaultTimelineDays" INTEGER NOT NULL,
    "requiredDocumentNames" TEXT[],
    "percentageWeight" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStageDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRequest" (
    "id" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "customerNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerBranch" TEXT,
    "loanAmount" DECIMAL(12,2) NOT NULL,
    "loanType" TEXT NOT NULL,
    "loanPurpose" TEXT NOT NULL,
    "submittedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedDate" TIMESTAMP(3) NOT NULL,
    "stageEntryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stageDeadline" TIMESTAMP(3),
    "isReadyForManagerReview" BOOLEAN NOT NULL DEFAULT false,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "isTerminalStage" BOOLEAN NOT NULL DEFAULT false,
    "workflowDefinitionIdMirror" TEXT NOT NULL,
    "workflowVersionIdMirror" TEXT NOT NULL,
    "currentStageIdMirror" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanDocument" (
    "id" TEXT NOT NULL,
    "loanRequestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "LoanDocumentStatus" NOT NULL,
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanHistoryEntry" (
    "id" TEXT NOT NULL,
    "loanRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "requiredFulfilment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_nameLowercase_key" ON "Department"("nameLowercase");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_loanType_key" ON "WorkflowDefinition"("loanType");

-- CreateIndex
CREATE INDEX "WorkflowVersion_workflowDefinitionId_isActive_idx" ON "WorkflowVersion"("workflowDefinitionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_workflowDefinitionId_versionNumber_key" ON "WorkflowVersion"("workflowDefinitionId", "versionNumber");

-- CreateIndex
CREATE INDEX "WorkflowStageDefinition_workflowVersionId_idx" ON "WorkflowStageDefinition"("workflowVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStageDefinition_workflowVersionId_order_key" ON "WorkflowStageDefinition"("workflowVersionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LoanRequest_loanNumber_key" ON "LoanRequest"("loanNumber");

-- CreateIndex
CREATE INDEX "LoanRequest_assignedToUserId_idx" ON "LoanRequest"("assignedToUserId");

-- CreateIndex
CREATE INDEX "LoanRequest_currentStageIdMirror_idx" ON "LoanRequest"("currentStageIdMirror");

-- CreateIndex
CREATE INDEX "LoanRequest_workflowVersionIdMirror_idx" ON "LoanRequest"("workflowVersionIdMirror");

-- CreateIndex
CREATE INDEX "LoanRequest_isOverdue_idx" ON "LoanRequest"("isOverdue");

-- CreateIndex
CREATE INDEX "LoanRequest_isReadyForManagerReview_idx" ON "LoanRequest"("isReadyForManagerReview");

-- CreateIndex
CREATE INDEX "LoanDocument_loanRequestId_idx" ON "LoanDocument"("loanRequestId");

-- CreateIndex
CREATE INDEX "LoanHistoryEntry_loanRequestId_idx" ON "LoanHistoryEntry"("loanRequestId");

-- CreateIndex
CREATE INDEX "LoanHistoryEntry_userId_idx" ON "LoanHistoryEntry"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStageDefinition" ADD CONSTRAINT "WorkflowStageDefinition_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStageDefinition" ADD CONSTRAINT "WorkflowStageDefinition_responsibleDepartmentId_fkey" FOREIGN KEY ("responsibleDepartmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRequest" ADD CONSTRAINT "LoanRequest_workflowDefinitionIdMirror_fkey" FOREIGN KEY ("workflowDefinitionIdMirror") REFERENCES "WorkflowDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRequest" ADD CONSTRAINT "LoanRequest_workflowVersionIdMirror_fkey" FOREIGN KEY ("workflowVersionIdMirror") REFERENCES "WorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRequest" ADD CONSTRAINT "LoanRequest_currentStageIdMirror_fkey" FOREIGN KEY ("currentStageIdMirror") REFERENCES "WorkflowStageDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRequest" ADD CONSTRAINT "LoanRequest_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanDocument" ADD CONSTRAINT "LoanDocument_loanRequestId_fkey" FOREIGN KEY ("loanRequestId") REFERENCES "LoanRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanHistoryEntry" ADD CONSTRAINT "LoanHistoryEntry_loanRequestId_fkey" FOREIGN KEY ("loanRequestId") REFERENCES "LoanRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanHistoryEntry" ADD CONSTRAINT "loan_history_user_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
