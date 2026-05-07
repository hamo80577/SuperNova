-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PICKER', 'CHAMP', 'AREA_MANAGER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('NEW_HIRE_PENDING', 'ACTIVE', 'RESIGNED', 'TERMINATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('INCOMPLETE', 'PENDING_REVIEW', 'COMPLETE');

-- CreateEnum
CREATE TYPE "BlockStatus" AS ENUM ('NO_BLOCK', 'TEMPORARY_BLOCK', 'PERMANENT_BLOCK');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ChainStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('NEW_HIRE', 'RESIGNATION', 'TERMINATION', 'TRANSFER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PENDING_AREA_MANAGER', 'PENDING_DESTINATION_AREA_MANAGER', 'PENDING_ADMIN', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ApprovalStep" AS ENUM ('AREA_MANAGER_APPROVAL', 'SOURCE_AREA_MANAGER_APPROVAL', 'DESTINATION_AREA_MANAGER_APPROVAL', 'ADMIN_FINAL_APPROVAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "ibsId" TEXT,
    "shopperId" TEXT,
    "role" "UserRole" NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "nationalId" TEXT,
    "address" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender" NOT NULL DEFAULT 'UNSPECIFIED',
    "joiningDate" TIMESTAMP(3),
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'NEW_HIRE_PENDING',
    "resignationDate" TIMESTAMP(3),
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'INACTIVE',
    "profileStatus" "ProfileStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "blockStatus" "BlockStatus" NOT NULL DEFAULT 'NO_BLOCK',
    "blockedUntil" TIMESTAMP(3),
    "blockReason" TEXT,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "temporaryPasswordExpiresAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chain" (
    "id" TEXT NOT NULL,
    "chainName" TEXT NOT NULL,
    "chainCode" TEXT NOT NULL,
    "status" "ChainStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "vendorExternalId" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "chainId" TEXT NOT NULL,
    "address" TEXT,
    "area" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickerBranchAssignment" (
    "id" TEXT NOT NULL,
    "pickerId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdByRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickerBranchAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorChampAssignment" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "champId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorChampAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainAreaManagerAssignment" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "areaManagerId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainAreaManagerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "targetUserId" TEXT,
    "sourceChainId" TEXT,
    "sourceVendorId" TEXT,
    "destinationChainId" TEXT,
    "destinationVendorId" TEXT,
    "payload" JSONB,
    "currentStep" "ApprovalStep",
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestApproval" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "step" "ApprovalStep" NOT NULL,
    "approverRole" "UserRole" NOT NULL,
    "approverId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decisionAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_ibsId_key" ON "User"("ibsId");

-- CreateIndex
CREATE UNIQUE INDEX "User_shopperId_key" ON "User"("shopperId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_nationalId_key" ON "User"("nationalId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");

-- CreateIndex
CREATE INDEX "User_employmentStatus_idx" ON "User"("employmentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Chain_chainCode_key" ON "Chain"("chainCode");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorExternalId_key" ON "Vendor"("vendorExternalId");

-- CreateIndex
CREATE INDEX "Vendor_chainId_idx" ON "Vendor"("chainId");

-- CreateIndex
CREATE INDEX "PickerBranchAssignment_pickerId_status_idx" ON "PickerBranchAssignment"("pickerId", "status");

-- CreateIndex
CREATE INDEX "PickerBranchAssignment_vendorId_status_idx" ON "PickerBranchAssignment"("vendorId", "status");

-- CreateIndex
CREATE INDEX "VendorChampAssignment_vendorId_status_idx" ON "VendorChampAssignment"("vendorId", "status");

-- CreateIndex
CREATE INDEX "VendorChampAssignment_champId_status_idx" ON "VendorChampAssignment"("champId", "status");

-- CreateIndex
CREATE INDEX "ChainAreaManagerAssignment_chainId_status_idx" ON "ChainAreaManagerAssignment"("chainId", "status");

-- CreateIndex
CREATE INDEX "ChainAreaManagerAssignment_areaManagerId_status_idx" ON "ChainAreaManagerAssignment"("areaManagerId", "status");

-- CreateIndex
CREATE INDEX "Request_status_idx" ON "Request"("status");

-- CreateIndex
CREATE INDEX "Request_type_idx" ON "Request"("type");

-- CreateIndex
CREATE INDEX "Request_createdById_idx" ON "Request"("createdById");

-- CreateIndex
CREATE INDEX "Request_targetUserId_idx" ON "Request"("targetUserId");

-- CreateIndex
CREATE INDEX "Request_sourceVendorId_idx" ON "Request"("sourceVendorId");

-- CreateIndex
CREATE INDEX "Request_destinationVendorId_idx" ON "Request"("destinationVendorId");

-- CreateIndex
CREATE INDEX "RequestApproval_approverId_status_idx" ON "RequestApproval"("approverId", "status");

-- CreateIndex
CREATE INDEX "RequestApproval_requestId_step_idx" ON "RequestApproval"("requestId", "step");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickerBranchAssignment" ADD CONSTRAINT "PickerBranchAssignment_pickerId_fkey" FOREIGN KEY ("pickerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickerBranchAssignment" ADD CONSTRAINT "PickerBranchAssignment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickerBranchAssignment" ADD CONSTRAINT "PickerBranchAssignment_createdByRequestId_fkey" FOREIGN KEY ("createdByRequestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorChampAssignment" ADD CONSTRAINT "VendorChampAssignment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorChampAssignment" ADD CONSTRAINT "VendorChampAssignment_champId_fkey" FOREIGN KEY ("champId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChainAreaManagerAssignment" ADD CONSTRAINT "ChainAreaManagerAssignment_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChainAreaManagerAssignment" ADD CONSTRAINT "ChainAreaManagerAssignment_areaManagerId_fkey" FOREIGN KEY ("areaManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_sourceChainId_fkey" FOREIGN KEY ("sourceChainId") REFERENCES "Chain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_sourceVendorId_fkey" FOREIGN KEY ("sourceVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_destinationChainId_fkey" FOREIGN KEY ("destinationChainId") REFERENCES "Chain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_destinationVendorId_fkey" FOREIGN KEY ("destinationVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestApproval" ADD CONSTRAINT "RequestApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestApproval" ADD CONSTRAINT "RequestApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
