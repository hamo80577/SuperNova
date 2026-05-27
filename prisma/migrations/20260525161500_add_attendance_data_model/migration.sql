-- CreateEnum
CREATE TYPE "AttendanceImportBatchStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'CONFIRMED', 'ACTIVE', 'REPLACED', 'FAILED', 'LOCKED');

-- CreateEnum
CREATE TYPE "AttendanceCalculatedStatus" AS ENUM ('ON_TIME', 'LATE', 'ABSENT', 'OFF_DAY', 'ANNUAL_LEAVE', 'MEDICAL_LEAVE', 'OTHER_LEAVE', 'EXCLUDED_NON_EGYPT', 'UNMATCHED_IDENTIFIER', 'EXCLUDED_NOT_PICKER', 'INVALID_OR_MISSING_ATTENDANCE_DATA');

-- CreateEnum
CREATE TYPE "AttendanceLateBucket" AS ENUM ('NONE', 'LATE_1', 'LATE_2', 'LATE_3');

-- CreateEnum
CREATE TYPE "AttendanceLeaveType" AS ENUM ('ANNUAL_LEAVE', 'MEDICAL_LEAVE', 'OTHER_LEAVE');

-- CreateEnum
CREATE TYPE "AttendanceMatchStatus" AS ENUM ('MATCHED_PICKER', 'UNMATCHED_IDENTIFIER', 'EXCLUDED_NOT_PICKER', 'EXCLUDED_NON_EGYPT');

-- CreateEnum
CREATE TYPE "AttendanceIssueSeverity" AS ENUM ('ERROR', 'WARNING');

-- CreateEnum
CREATE TYPE "AttendanceIssueResolutionStatus" AS ENUM ('OPEN', 'IGNORED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AttendanceIssueCode" AS ENUM ('MTD_COVERAGE_START_NOT_MONTH_START', 'MTD_COVERAGE_END_NOT_YESTERDAY', 'MTD_INCLUDES_UPLOAD_DAY', 'MTD_INCLUDES_FUTURE_DATE', 'MISSING_IDENTIFIER', 'UNMATCHED_IDENTIFIER', 'MATCHED_USER_NOT_PICKER', 'NON_EGYPT_ROW', 'INVALID_SHIFT_DATE', 'INVALID_TIME', 'MISSING_CHECKIN', 'UNKNOWN_STATUS', 'DUPLICATE_PICKER_DATE', 'MULTIPLE_MONTHS_IN_FILE', 'INVALID_REQUIRED_COLUMN', 'INVALID_WORK_DURATION', 'INVALID_SHIFT_DURATION', 'INVALID_BREAK_DURATION');

-- CreateTable
CREATE TABLE "AttendanceImportBatch" (
    "id" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AttendanceImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "egyptRows" INTEGER NOT NULL DEFAULT 0,
    "matchedPickerRows" INTEGER NOT NULL DEFAULT 0,
    "unmatchedRows" INTEGER NOT NULL DEFAULT 0,
    "excludedNonPickerRows" INTEGER NOT NULL DEFAULT 0,
    "excludedNonEgyptRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "coverageStartDate" TIMESTAMP(3),
    "coverageEndDate" TIMESTAMP(3),
    "expectedCoverageEndDate" TIMESTAMP(3),
    "replaceOfBatchId" TEXT,
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDailyRecord" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "shiftDate" TIMESTAMP(3) NOT NULL,
    "shopperId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pickerNameSnapshot" TEXT NOT NULL,
    "sourceName" TEXT,
    "sourceDesignation" TEXT,
    "division" TEXT NOT NULL,
    "sourceSubDivision" TEXT,
    "sourceLocation" TEXT,
    "sourceLocationCode" TEXT,
    "shiftName" TEXT NOT NULL,
    "scheduledStartTime" TEXT,
    "scheduledEndTime" TEXT,
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "scheduledShiftHours" DECIMAL(6,2),
    "breakDurationMins" INTEGER,
    "actualCheckinTime" TIMESTAMP(3),
    "actualCheckoutTime" TIMESTAMP(3),
    "actualWorkDurationHours" DECIMAL(6,2),
    "sourceStatus" TEXT,
    "calculatedStatus" "AttendanceCalculatedStatus" NOT NULL,
    "rawLateMins" INTEGER,
    "graceMins" INTEGER,
    "chargeableLateMins" INTEGER,
    "lateBucket" "AttendanceLateBucket",
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "isOnTime" BOOLEAN NOT NULL DEFAULT false,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "isOffDay" BOOLEAN NOT NULL DEFAULT false,
    "isOnLeave" BOOLEAN NOT NULL DEFAULT false,
    "leaveType" "AttendanceLeaveType",
    "isAnnualLeave" BOOLEAN NOT NULL DEFAULT false,
    "isMedicalLeave" BOOLEAN NOT NULL DEFAULT false,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT false,
    "isUnder8Hours" BOOLEAN NOT NULL DEFAULT false,
    "isOver15Hours" BOOLEAN NOT NULL DEFAULT false,
    "matchStatus" "AttendanceMatchStatus" NOT NULL DEFAULT 'MATCHED_PICKER',
    "rawRowNumber" INTEGER NOT NULL,
    "rowHash" TEXT NOT NULL,
    "issuesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDailyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePickerMonthlySummary" (
    "id" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "sourceBatchId" TEXT NOT NULL,
    "shopperId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pickerNameSnapshot" TEXT NOT NULL,
    "totalScheduledRows" INTEGER NOT NULL DEFAULT 0,
    "totalWorkingDays" INTEGER NOT NULL DEFAULT 0,
    "onTimeDays" INTEGER NOT NULL DEFAULT 0,
    "lateDays" INTEGER NOT NULL DEFAULT 0,
    "totalRawLateMins" INTEGER NOT NULL DEFAULT 0,
    "totalChargeableLateMins" INTEGER NOT NULL DEFAULT 0,
    "late1Count" INTEGER NOT NULL DEFAULT 0,
    "late2Count" INTEGER NOT NULL DEFAULT 0,
    "late3Count" INTEGER NOT NULL DEFAULT 0,
    "absentCount" INTEGER NOT NULL DEFAULT 0,
    "leaveCount" INTEGER NOT NULL DEFAULT 0,
    "annualLeaveCount" INTEGER NOT NULL DEFAULT 0,
    "medicalLeaveCount" INTEGER NOT NULL DEFAULT 0,
    "otherLeaveCount" INTEGER NOT NULL DEFAULT 0,
    "offDayCount" INTEGER NOT NULL DEFAULT 0,
    "under8HoursCount" INTEGER NOT NULL DEFAULT 0,
    "over15HoursCount" INTEGER NOT NULL DEFAULT 0,
    "firstShiftDate" TIMESTAMP(3),
    "lastShiftDate" TIMESTAMP(3),
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePickerMonthlySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceImportIssue" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "shopperId" TEXT,
    "severity" "AttendanceIssueSeverity" NOT NULL,
    "issueCode" "AttendanceIssueCode" NOT NULL,
    "fieldName" TEXT,
    "message" TEXT NOT NULL,
    "resolutionStatus" "AttendanceIssueResolutionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceImportIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_periodMonth_status_idx" ON "AttendanceImportBatch"("periodMonth", "status");

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_uploadedAt_idx" ON "AttendanceImportBatch"("uploadedAt");

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_uploadedByUserId_idx" ON "AttendanceImportBatch"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_confirmedByUserId_idx" ON "AttendanceImportBatch"("confirmedByUserId");

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_replaceOfBatchId_idx" ON "AttendanceImportBatch"("replaceOfBatchId");

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_fileHash_idx" ON "AttendanceImportBatch"("fileHash");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_periodMonth_shiftDate_idx" ON "AttendanceDailyRecord"("periodMonth", "shiftDate");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_periodMonth_userId_idx" ON "AttendanceDailyRecord"("periodMonth", "userId");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_shopperId_idx" ON "AttendanceDailyRecord"("shopperId");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_importBatchId_idx" ON "AttendanceDailyRecord"("importBatchId");

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_userId_idx" ON "AttendanceDailyRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDailyRecord_importBatchId_userId_shiftDate_key" ON "AttendanceDailyRecord"("importBatchId", "userId", "shiftDate");

-- CreateIndex
CREATE INDEX "AttendancePickerMonthlySummary_periodMonth_userId_idx" ON "AttendancePickerMonthlySummary"("periodMonth", "userId");

-- CreateIndex
CREATE INDEX "AttendancePickerMonthlySummary_sourceBatchId_idx" ON "AttendancePickerMonthlySummary"("sourceBatchId");

-- CreateIndex
CREATE INDEX "AttendancePickerMonthlySummary_shopperId_idx" ON "AttendancePickerMonthlySummary"("shopperId");

-- CreateIndex
CREATE INDEX "AttendancePickerMonthlySummary_userId_idx" ON "AttendancePickerMonthlySummary"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePickerMonthlySummary_sourceBatchId_userId_key" ON "AttendancePickerMonthlySummary"("sourceBatchId", "userId");

-- CreateIndex
CREATE INDEX "AttendanceImportIssue_batchId_idx" ON "AttendanceImportIssue"("batchId");

-- CreateIndex
CREATE INDEX "AttendanceImportIssue_issueCode_idx" ON "AttendanceImportIssue"("issueCode");

-- CreateIndex
CREATE INDEX "AttendanceImportIssue_severity_idx" ON "AttendanceImportIssue"("severity");

-- CreateIndex
CREATE INDEX "AttendanceImportIssue_resolutionStatus_idx" ON "AttendanceImportIssue"("resolutionStatus");

-- AddForeignKey
ALTER TABLE "AttendanceImportBatch" ADD CONSTRAINT "AttendanceImportBatch_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceImportBatch" ADD CONSTRAINT "AttendanceImportBatch_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceImportBatch" ADD CONSTRAINT "AttendanceImportBatch_replaceOfBatchId_fkey" FOREIGN KEY ("replaceOfBatchId") REFERENCES "AttendanceImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDailyRecord" ADD CONSTRAINT "AttendanceDailyRecord_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "AttendanceImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDailyRecord" ADD CONSTRAINT "AttendanceDailyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePickerMonthlySummary" ADD CONSTRAINT "AttendancePickerMonthlySummary_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "AttendanceImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePickerMonthlySummary" ADD CONSTRAINT "AttendancePickerMonthlySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceImportIssue" ADD CONSTRAINT "AttendanceImportIssue_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AttendanceImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

