-- CreateEnum
CREATE TYPE "AttendanceLocationMappingStatus" AS ENUM ('NOT_CHECKED', 'MAPPED_VENDOR_CODE', 'MAPPED_VENDOR_EXTERNAL_ID', 'UNMAPPED', 'MISSING_CODE');

-- CreateEnum
CREATE TYPE "AttendanceAssignmentMismatchStatus" AS ENUM ('NOT_CHECKED', 'MATCHES_ACTIVE_ASSIGNMENT', 'DIFFERS_FROM_ACTIVE_ASSIGNMENT', 'NO_ACTIVE_ASSIGNMENT');

-- AlterEnum
ALTER TYPE "AttendanceIssueCode" ADD VALUE 'UNMAPPED_ATTENDANCE_LOCATION';
ALTER TYPE "AttendanceIssueCode" ADD VALUE 'LOCATION_SHIFT_LOCATION_DIFFERENCE';
ALTER TYPE "AttendanceIssueCode" ADD VALUE 'ACTIVE_ASSIGNMENT_MISMATCH';
ALTER TYPE "AttendanceIssueCode" ADD VALUE 'MISSING_ATTENDANCE_LOCATION_CODE';

-- AlterTable
ALTER TABLE "AttendanceDailyRecord"
  ADD COLUMN "reportedVendorId" TEXT,
  ADD COLUMN "reportedChainId" TEXT,
  ADD COLUMN "reportedLocationCode" TEXT,
  ADD COLUMN "reportedLocationName" TEXT,
  ADD COLUMN "reportedLocationRaw" TEXT,
  ADD COLUMN "shiftLocationCode" TEXT,
  ADD COLUMN "shiftLocationName" TEXT,
  ADD COLUMN "shiftLocationRaw" TEXT,
  ADD COLUMN "locationMappingStatus" "AttendanceLocationMappingStatus" NOT NULL DEFAULT 'NOT_CHECKED',
  ADD COLUMN "assignmentMismatchStatus" "AttendanceAssignmentMismatchStatus" NOT NULL DEFAULT 'NOT_CHECKED';

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_reportedVendorId_idx" ON "AttendanceDailyRecord"("reportedVendorId");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_reportedChainId_idx" ON "AttendanceDailyRecord"("reportedChainId");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_periodMonth_reportedVendorId_idx" ON "AttendanceDailyRecord"("periodMonth", "reportedVendorId");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_periodMonth_reportedChainId_idx" ON "AttendanceDailyRecord"("periodMonth", "reportedChainId");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_locationMappingStatus_idx" ON "AttendanceDailyRecord"("locationMappingStatus");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_assignmentMismatchStatus_idx" ON "AttendanceDailyRecord"("assignmentMismatchStatus");
