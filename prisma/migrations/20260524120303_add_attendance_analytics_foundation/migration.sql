-- CreateEnum
CREATE TYPE "AttendanceImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceImportMode" AS ENUM ('DAILY_MTD_OVERRIDE', 'HISTORICAL_BACKFILL', 'RECALCULATE_ONLY', 'DELETE_RANGE', 'DELETE_MONTH', 'DELETE_ALL', 'COMPRESS_OLD_MONTHS');

-- CreateEnum
CREATE TYPE "AttendanceMatchedRole" AS ENUM ('PICKER', 'CHAMP');

-- CreateEnum
CREATE TYPE "AttendanceMatchKeyType" AS ENUM ('SHOPPER_ID', 'IBS_ID');

-- CreateEnum
CREATE TYPE "AttendanceRecordStatus" AS ENUM ('ON_TIME', 'LATE', 'ABSENT', 'ON_LEAVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AttendanceArchiveStatus" AS ENUM ('DETAILED', 'SUMMARY_ONLY', 'COMPRESSED');

-- CreateEnum
CREATE TYPE "AttendanceIssueSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "AttendanceIssueType" AS ENUM ('NON_EGYPT_ROW_IGNORED', 'UNMATCHED_IDENTIFIER', 'AMBIGUOUS_IDENTIFIER_MATCH', 'UNSUPPORTED_ROLE', 'DUPLICATE_IDENTIFIER_SHIFT_DATE', 'ROW_PARSE_ERROR', 'MISSING_REQUIRED_COLUMN', 'INVALID_DATE', 'INVALID_TIME', 'MISSING_ASSIGNMENT', 'RETENTION_COMPRESSION_SKIPPED', 'MAINTENANCE_OPERATION_WARNING');

-- CreateTable
CREATE TABLE "AttendanceImportBatch" (
    "id" TEXT NOT NULL,
    "mode" "AttendanceImportMode" NOT NULL,
    "status" "AttendanceImportStatus" NOT NULL DEFAULT 'PENDING',
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "fileName" TEXT,
    "fileHash" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "egyptRows" INTEGER NOT NULL DEFAULT 0,
    "ignoredRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "matchedPickers" INTEGER NOT NULL DEFAULT 0,
    "matchedChamps" INTEGER NOT NULL DEFAULT 0,
    "unmatchedIdentifiers" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "warningsCount" INTEGER NOT NULL DEFAULT 0,
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "dailyRecordsStored" INTEGER NOT NULL DEFAULT 0,
    "userSummariesStored" INTEGER NOT NULL DEFAULT 0,
    "branchSummariesRebuilt" INTEGER NOT NULL DEFAULT 0,
    "chainSummariesRebuilt" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDailyRecord" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "matchedUserId" TEXT NOT NULL,
    "matchedUserRole" "AttendanceMatchedRole" NOT NULL,
    "matchKeyType" "AttendanceMatchKeyType" NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "monthKey" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "rawName" TEXT,
    "rawDesignation" TEXT,
    "rawLocation" TEXT,
    "rawStatus" TEXT,
    "status" "AttendanceRecordStatus" NOT NULL,
    "shiftName" TEXT,
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "actualCheckInAt" TIMESTAMP(3),
    "actualCheckOutAt" TIMESTAMP(3),
    "actualWorkDurationHours" DECIMAL(6,2),
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateLevel1Over15" BOOLEAN NOT NULL DEFAULT false,
    "lateLevel2From31To45" BOOLEAN NOT NULL DEFAULT false,
    "lateLevel3Over45" BOOLEAN NOT NULL DEFAULT false,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "isOnLeave" BOOLEAN NOT NULL DEFAULT false,
    "isAnnualLeave" BOOLEAN NOT NULL DEFAULT false,
    "isMedicalLeave" BOOLEAN NOT NULL DEFAULT false,
    "isOffDay" BOOLEAN NOT NULL DEFAULT false,
    "isUnder8Hours" BOOLEAN NOT NULL DEFAULT false,
    "isOver15Hours" BOOLEAN NOT NULL DEFAULT false,
    "isWorkedShift" BOOLEAN NOT NULL DEFAULT false,
    "assignmentVendorId" TEXT,
    "assignmentChainId" TEXT,
    "archiveStatus" "AttendanceArchiveStatus" NOT NULL DEFAULT 'DETAILED',
    "rowFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDailyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceMonthlyUserSummary" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "role" "AttendanceMatchedRole" NOT NULL,
    "matchKeyType" "AttendanceMatchKeyType" NOT NULL,
    "assignmentVendorId" TEXT,
    "assignmentChainId" TEXT,
    "totalShiftsNeeded" INTEGER NOT NULL DEFAULT 0,
    "totalCreatedShifts" INTEGER NOT NULL DEFAULT 0,
    "missingShifts" INTEGER NOT NULL DEFAULT 0,
    "workedShiftCount" INTEGER NOT NULL DEFAULT 0,
    "totalWorkedHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lateMinutesTotal" INTEGER NOT NULL DEFAULT 0,
    "lateLevel1Over15Count" INTEGER NOT NULL DEFAULT 0,
    "lateLevel2From31To45Count" INTEGER NOT NULL DEFAULT 0,
    "lateLevel3Over45Count" INTEGER NOT NULL DEFAULT 0,
    "absentCount" INTEGER NOT NULL DEFAULT 0,
    "onLeaveCount" INTEGER NOT NULL DEFAULT 0,
    "annualLeaveCount" INTEGER NOT NULL DEFAULT 0,
    "medicalLeaveCount" INTEGER NOT NULL DEFAULT 0,
    "offDayCount" INTEGER NOT NULL DEFAULT 0,
    "under8HoursCount" INTEGER NOT NULL DEFAULT 0,
    "over15HoursCount" INTEGER NOT NULL DEFAULT 0,
    "sourceDailyRecordsAvailable" BOOLEAN NOT NULL DEFAULT true,
    "archiveStatus" "AttendanceArchiveStatus" NOT NULL DEFAULT 'DETAILED',
    "lastImportBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceMonthlyUserSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceMonthlyBranchSummary" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "pickerCount" INTEGER NOT NULL DEFAULT 0,
    "totalShiftsNeeded" INTEGER NOT NULL DEFAULT 0,
    "totalCreatedShifts" INTEGER NOT NULL DEFAULT 0,
    "missingShifts" INTEGER NOT NULL DEFAULT 0,
    "workedShiftCount" INTEGER NOT NULL DEFAULT 0,
    "totalWorkedHours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lateMinutesTotal" INTEGER NOT NULL DEFAULT 0,
    "lateLevel1Over15Count" INTEGER NOT NULL DEFAULT 0,
    "lateLevel2From31To45Count" INTEGER NOT NULL DEFAULT 0,
    "lateLevel3Over45Count" INTEGER NOT NULL DEFAULT 0,
    "absentCount" INTEGER NOT NULL DEFAULT 0,
    "onLeaveCount" INTEGER NOT NULL DEFAULT 0,
    "annualLeaveCount" INTEGER NOT NULL DEFAULT 0,
    "medicalLeaveCount" INTEGER NOT NULL DEFAULT 0,
    "offDayCount" INTEGER NOT NULL DEFAULT 0,
    "under8HoursCount" INTEGER NOT NULL DEFAULT 0,
    "over15HoursCount" INTEGER NOT NULL DEFAULT 0,
    "lastImportBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceMonthlyBranchSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceMonthlyChainSummary" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "chainId" TEXT NOT NULL,
    "branchCount" INTEGER NOT NULL DEFAULT 0,
    "pickerCount" INTEGER NOT NULL DEFAULT 0,
    "totalShiftsNeeded" INTEGER NOT NULL DEFAULT 0,
    "totalCreatedShifts" INTEGER NOT NULL DEFAULT 0,
    "missingShifts" INTEGER NOT NULL DEFAULT 0,
    "workedShiftCount" INTEGER NOT NULL DEFAULT 0,
    "totalWorkedHours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lateMinutesTotal" INTEGER NOT NULL DEFAULT 0,
    "lateLevel1Over15Count" INTEGER NOT NULL DEFAULT 0,
    "lateLevel2From31To45Count" INTEGER NOT NULL DEFAULT 0,
    "lateLevel3Over45Count" INTEGER NOT NULL DEFAULT 0,
    "absentCount" INTEGER NOT NULL DEFAULT 0,
    "onLeaveCount" INTEGER NOT NULL DEFAULT 0,
    "annualLeaveCount" INTEGER NOT NULL DEFAULT 0,
    "medicalLeaveCount" INTEGER NOT NULL DEFAULT 0,
    "offDayCount" INTEGER NOT NULL DEFAULT 0,
    "under8HoursCount" INTEGER NOT NULL DEFAULT 0,
    "over15HoursCount" INTEGER NOT NULL DEFAULT 0,
    "lastImportBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceMonthlyChainSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceImportIssue" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "severity" "AttendanceIssueSeverity" NOT NULL,
    "type" "AttendanceIssueType" NOT NULL,
    "rowNumber" INTEGER,
    "identifier" TEXT,
    "attendanceDate" TIMESTAMP(3),
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceImportIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_status_idx" ON "AttendanceImportBatch"("status");

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_mode_idx" ON "AttendanceImportBatch"("mode");

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_periodFrom_periodTo_idx" ON "AttendanceImportBatch"("periodFrom", "periodTo");

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_createdAt_idx" ON "AttendanceImportBatch"("createdAt");

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_createdById_idx" ON "AttendanceImportBatch"("createdById");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_importBatchId_idx" ON "AttendanceDailyRecord"("importBatchId");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_matchedUserId_idx" ON "AttendanceDailyRecord"("matchedUserId");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_identifier_idx" ON "AttendanceDailyRecord"("identifier");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_identifier_attendanceDate_idx" ON "AttendanceDailyRecord"("identifier", "attendanceDate");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_matchedUserRole_idx" ON "AttendanceDailyRecord"("matchedUserRole");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_attendanceDate_idx" ON "AttendanceDailyRecord"("attendanceDate");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_monthKey_idx" ON "AttendanceDailyRecord"("monthKey");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_assignmentVendorId_idx" ON "AttendanceDailyRecord"("assignmentVendorId");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_assignmentChainId_idx" ON "AttendanceDailyRecord"("assignmentChainId");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_archiveStatus_idx" ON "AttendanceDailyRecord"("archiveStatus");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_status_idx" ON "AttendanceDailyRecord"("status");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_rowFingerprint_idx" ON "AttendanceDailyRecord"("rowFingerprint");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyUserSummary_monthKey_idx" ON "AttendanceMonthlyUserSummary"("monthKey");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyUserSummary_userId_idx" ON "AttendanceMonthlyUserSummary"("userId");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyUserSummary_role_idx" ON "AttendanceMonthlyUserSummary"("role");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyUserSummary_assignmentVendorId_idx" ON "AttendanceMonthlyUserSummary"("assignmentVendorId");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyUserSummary_assignmentChainId_idx" ON "AttendanceMonthlyUserSummary"("assignmentChainId");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyUserSummary_archiveStatus_idx" ON "AttendanceMonthlyUserSummary"("archiveStatus");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyUserSummary_lastImportBatchId_idx" ON "AttendanceMonthlyUserSummary"("lastImportBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceMonthlyUserSummary_monthKey_userId_key" ON "AttendanceMonthlyUserSummary"("monthKey", "userId");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyBranchSummary_monthKey_idx" ON "AttendanceMonthlyBranchSummary"("monthKey");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyBranchSummary_vendorId_idx" ON "AttendanceMonthlyBranchSummary"("vendorId");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyBranchSummary_chainId_idx" ON "AttendanceMonthlyBranchSummary"("chainId");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyBranchSummary_lastImportBatchId_idx" ON "AttendanceMonthlyBranchSummary"("lastImportBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceMonthlyBranchSummary_monthKey_vendorId_key" ON "AttendanceMonthlyBranchSummary"("monthKey", "vendorId");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyChainSummary_monthKey_idx" ON "AttendanceMonthlyChainSummary"("monthKey");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyChainSummary_chainId_idx" ON "AttendanceMonthlyChainSummary"("chainId");

-- CreateIndex
CREATE INDEX "AttendanceMonthlyChainSummary_lastImportBatchId_idx" ON "AttendanceMonthlyChainSummary"("lastImportBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceMonthlyChainSummary_monthKey_chainId_key" ON "AttendanceMonthlyChainSummary"("monthKey", "chainId");

-- CreateIndex
CREATE INDEX "AttendanceImportIssue_importBatchId_idx" ON "AttendanceImportIssue"("importBatchId");

-- CreateIndex
CREATE INDEX "AttendanceImportIssue_severity_idx" ON "AttendanceImportIssue"("severity");

-- CreateIndex
CREATE INDEX "AttendanceImportIssue_type_idx" ON "AttendanceImportIssue"("type");

-- CreateIndex
CREATE INDEX "AttendanceImportIssue_identifier_idx" ON "AttendanceImportIssue"("identifier");

-- CreateIndex
CREATE INDEX "AttendanceImportIssue_attendanceDate_idx" ON "AttendanceImportIssue"("attendanceDate");

-- AddForeignKey
ALTER TABLE "AttendanceImportBatch" ADD CONSTRAINT "AttendanceImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDailyRecord" ADD CONSTRAINT "AttendanceDailyRecord_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AttendanceImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDailyRecord" ADD CONSTRAINT "AttendanceDailyRecord_matchedUserId_fkey" FOREIGN KEY ("matchedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDailyRecord" ADD CONSTRAINT "AttendanceDailyRecord_assignmentVendorId_fkey" FOREIGN KEY ("assignmentVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDailyRecord" ADD CONSTRAINT "AttendanceDailyRecord_assignmentChainId_fkey" FOREIGN KEY ("assignmentChainId") REFERENCES "Chain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMonthlyUserSummary" ADD CONSTRAINT "AttendanceMonthlyUserSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMonthlyUserSummary" ADD CONSTRAINT "AttendanceMonthlyUserSummary_assignmentVendorId_fkey" FOREIGN KEY ("assignmentVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMonthlyUserSummary" ADD CONSTRAINT "AttendanceMonthlyUserSummary_assignmentChainId_fkey" FOREIGN KEY ("assignmentChainId") REFERENCES "Chain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMonthlyUserSummary" ADD CONSTRAINT "AttendanceMonthlyUserSummary_lastImportBatchId_fkey" FOREIGN KEY ("lastImportBatchId") REFERENCES "AttendanceImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMonthlyBranchSummary" ADD CONSTRAINT "AttendanceMonthlyBranchSummary_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMonthlyBranchSummary" ADD CONSTRAINT "AttendanceMonthlyBranchSummary_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMonthlyBranchSummary" ADD CONSTRAINT "AttendanceMonthlyBranchSummary_lastImportBatchId_fkey" FOREIGN KEY ("lastImportBatchId") REFERENCES "AttendanceImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMonthlyChainSummary" ADD CONSTRAINT "AttendanceMonthlyChainSummary_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMonthlyChainSummary" ADD CONSTRAINT "AttendanceMonthlyChainSummary_lastImportBatchId_fkey" FOREIGN KEY ("lastImportBatchId") REFERENCES "AttendanceImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceImportIssue" ADD CONSTRAINT "AttendanceImportIssue_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AttendanceImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
