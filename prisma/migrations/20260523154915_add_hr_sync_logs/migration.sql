-- CreateEnum
CREATE TYPE "HrSyncWorkflowType" AS ENUM ('PICKER_NEW_HIRE', 'PICKER_REHIRE', 'PICKER_RESIGNATION');

-- CreateEnum
CREATE TYPE "HrSyncTargetSheet" AS ENUM ('NEW_HIRE', 'RESIGN');

-- CreateEnum
CREATE TYPE "HrSyncStatus" AS ENUM ('NOT_SENT', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "HrSyncLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "workflowType" "HrSyncWorkflowType" NOT NULL,
    "targetSheet" "HrSyncTargetSheet" NOT NULL,
    "status" "HrSyncStatus" NOT NULL DEFAULT 'NOT_SENT',
    "payloadSnapshot" JSONB NOT NULL,
    "responseSnapshot" JSONB,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrSyncLog_requestId_idx" ON "HrSyncLog"("requestId");

-- CreateIndex
CREATE INDEX "HrSyncLog_status_idx" ON "HrSyncLog"("status");

-- CreateIndex
CREATE INDEX "HrSyncLog_workflowType_idx" ON "HrSyncLog"("workflowType");

-- CreateIndex
CREATE INDEX "HrSyncLog_createdAt_idx" ON "HrSyncLog"("createdAt");

-- AddForeignKey
ALTER TABLE "HrSyncLog" ADD CONSTRAINT "HrSyncLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
