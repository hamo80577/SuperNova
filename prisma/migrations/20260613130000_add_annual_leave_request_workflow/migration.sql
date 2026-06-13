-- Annual Leave self-request workflow.
-- New request type, a Champ approval step, a pending-champ status, and the
-- dedicated AnnualLeaveRequest detail table (1:1 with Request). The new enum
-- values are not used by any statement in this migration, so adding them in
-- the same transaction is safe.

ALTER TYPE "RequestType" ADD VALUE IF NOT EXISTS 'ANNUAL_LEAVE';
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_CHAMP';
ALTER TYPE "ApprovalStep" ADD VALUE IF NOT EXISTS 'CHAMP_APPROVAL';

CREATE TABLE "AnnualLeaveRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetRole" "UserRole" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "requestedDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "contextVendorId" TEXT,
    "contextChainId" TEXT,
    "balanceCarriedSnapshot" DECIMAL(6,2),
    "balanceAccruedSnapshot" DECIMAL(6,2),
    "balanceTakenSnapshot" DECIMAL(6,2),
    "balanceHeldSnapshot" DECIMAL(6,2),
    "availableBeforeRequestSnapshot" DECIMAL(6,2),
    "availableAfterRequestSnapshot" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnnualLeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnualLeaveRequest_requestId_key" ON "AnnualLeaveRequest"("requestId");
CREATE INDEX "AnnualLeaveRequest_targetUserId_startDate_idx" ON "AnnualLeaveRequest"("targetUserId", "startDate");
CREATE INDEX "AnnualLeaveRequest_targetUserId_endDate_idx" ON "AnnualLeaveRequest"("targetUserId", "endDate");
CREATE INDEX "AnnualLeaveRequest_contextVendorId_idx" ON "AnnualLeaveRequest"("contextVendorId");

ALTER TABLE "AnnualLeaveRequest" ADD CONSTRAINT "AnnualLeaveRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnualLeaveRequest" ADD CONSTRAINT "AnnualLeaveRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
