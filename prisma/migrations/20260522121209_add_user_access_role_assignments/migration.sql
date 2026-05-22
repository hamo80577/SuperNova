-- CreateEnum
CREATE TYPE "AccessRoleAssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "UserAccessRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessRoleId" TEXT NOT NULL,
    "status" "AccessRoleAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccessRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAccessRoleAssignment_userId_status_idx" ON "UserAccessRoleAssignment"("userId", "status");

-- CreateIndex
CREATE INDEX "UserAccessRoleAssignment_accessRoleId_status_idx" ON "UserAccessRoleAssignment"("accessRoleId", "status");

-- CreateIndex
CREATE INDEX "UserAccessRoleAssignment_userId_accessRoleId_status_idx" ON "UserAccessRoleAssignment"("userId", "accessRoleId", "status");

-- AddForeignKey
ALTER TABLE "UserAccessRoleAssignment" ADD CONSTRAINT "UserAccessRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRoleAssignment" ADD CONSTRAINT "UserAccessRoleAssignment_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "AccessRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
