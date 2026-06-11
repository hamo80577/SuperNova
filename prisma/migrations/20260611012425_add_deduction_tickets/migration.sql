-- CreateEnum
CREATE TYPE "DeductionPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeductionActionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DeductionPenaltyType" AS ENUM ('WARNING', 'DEDUCTION_DAYS', 'LIFECYCLE_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "DeductionCaseStatus" AS ENUM ('PENDING_APPROVAL', 'EFFECTIVE', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "RequestType" ADD VALUE 'DEDUCTION';

-- CreateTable
CREATE TABLE "DeductionPolicyVersion" (
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "DeductionPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeductionPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeductionAction" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "DeductionActionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeductionAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeductionRuleStep" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "occurrenceNumber" INTEGER NOT NULL,
    "appliesFromOccurrence" INTEGER,
    "penaltyType" "DeductionPenaltyType" NOT NULL,
    "deductionDays" DECIMAL(6,2),
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeductionRuleStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeductionCase" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "actionId" TEXT,
    "policyVersionId" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "incidentMonth" TEXT NOT NULL,
    "occurrenceNumber" INTEGER NOT NULL,
    "penaltyType" "DeductionPenaltyType" NOT NULL,
    "deductionDays" DECIMAL(6,2),
    "penaltyLabel" TEXT NOT NULL,
    "actionNameSnapshot" TEXT NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "targetSnapshot" JSONB NOT NULL,
    "scopeSnapshot" JSONB NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "status" "DeductionCaseStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "finalApprovedById" TEXT,
    "finalApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeductionCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeductionPolicyVersion_versionNumber_key" ON "DeductionPolicyVersion"("versionNumber");

-- CreateIndex
CREATE INDEX "DeductionPolicyVersion_status_idx" ON "DeductionPolicyVersion"("status");

-- CreateIndex
CREATE INDEX "DeductionAction_policyVersionId_status_idx" ON "DeductionAction"("policyVersionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DeductionAction_policyVersionId_code_key" ON "DeductionAction"("policyVersionId", "code");

-- CreateIndex
CREATE INDEX "DeductionRuleStep_actionId_idx" ON "DeductionRuleStep"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "DeductionRuleStep_actionId_occurrenceNumber_key" ON "DeductionRuleStep"("actionId", "occurrenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DeductionCase_requestId_key" ON "DeductionCase"("requestId");

-- CreateIndex
CREATE INDEX "DeductionCase_targetUserId_incidentMonth_idx" ON "DeductionCase"("targetUserId", "incidentMonth");

-- CreateIndex
CREATE INDEX "DeductionCase_targetUserId_actionId_incidentMonth_idx" ON "DeductionCase"("targetUserId", "actionId", "incidentMonth");

-- CreateIndex
CREATE INDEX "DeductionCase_status_idx" ON "DeductionCase"("status");

-- CreateIndex
CREATE INDEX "DeductionCase_status_incidentMonth_idx" ON "DeductionCase"("status", "incidentMonth");

-- CreateIndex
CREATE INDEX "DeductionCase_createdById_idx" ON "DeductionCase"("createdById");

-- CreateIndex
CREATE INDEX "DeductionCase_actionId_incidentMonth_idx" ON "DeductionCase"("actionId", "incidentMonth");

-- AddForeignKey
ALTER TABLE "DeductionPolicyVersion" ADD CONSTRAINT "DeductionPolicyVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionAction" ADD CONSTRAINT "DeductionAction_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "DeductionPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionRuleStep" ADD CONSTRAINT "DeductionRuleStep_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "DeductionAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionCase" ADD CONSTRAINT "DeductionCase_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionCase" ADD CONSTRAINT "DeductionCase_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionCase" ADD CONSTRAINT "DeductionCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionCase" ADD CONSTRAINT "DeductionCase_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "DeductionAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionCase" ADD CONSTRAINT "DeductionCase_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "DeductionPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionCase" ADD CONSTRAINT "DeductionCase_finalApprovedById_fkey" FOREIGN KEY ("finalApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
