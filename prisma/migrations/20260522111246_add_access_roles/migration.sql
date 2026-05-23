-- CreateEnum
CREATE TYPE "AccessRoleKind" AS ENUM ('SYSTEM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AccessRoleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "AccessRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "AccessRoleKind" NOT NULL,
    "systemRole" "UserRole",
    "status" "AccessRoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRolePermission" (
    "id" TEXT NOT NULL,
    "accessRoleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessRole_key_key" ON "AccessRole"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRole_systemRole_key" ON "AccessRole"("systemRole");

-- CreateIndex
CREATE INDEX "AccessRole_kind_status_idx" ON "AccessRole"("kind", "status");

-- CreateIndex
CREATE INDEX "AccessRole_status_idx" ON "AccessRole"("status");

-- CreateIndex
CREATE INDEX "AccessRolePermission_permissionKey_idx" ON "AccessRolePermission"("permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRolePermission_accessRoleId_permissionKey_key" ON "AccessRolePermission"("accessRoleId", "permissionKey");

-- AddForeignKey
ALTER TABLE "AccessRolePermission" ADD CONSTRAINT "AccessRolePermission_accessRoleId_fkey" FOREIGN KEY ("accessRoleId") REFERENCES "AccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
