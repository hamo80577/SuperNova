-- CreateEnum
CREATE TYPE "AttendanceImportMode" AS ENUM ('MTD', 'HISTORICAL_MONTH');

-- AlterEnum
ALTER TYPE "AttendanceIssueCode" ADD VALUE 'INVALID_ATTENDANCE_IMPORT_MODE';
ALTER TYPE "AttendanceIssueCode" ADD VALUE 'HISTORICAL_PERIOD_MONTH_REQUIRED';
ALTER TYPE "AttendanceIssueCode" ADD VALUE 'INVALID_HISTORICAL_PERIOD_MONTH';
ALTER TYPE "AttendanceIssueCode" ADD VALUE 'HISTORICAL_PERIOD_MONTH_NOT_CLOSED';
ALTER TYPE "AttendanceIssueCode" ADD VALUE 'SHIFT_DATE_OUTSIDE_SELECTED_PERIOD_MONTH';

-- AlterTable
ALTER TABLE "AttendanceImportBatch"
  ADD COLUMN "importMode" "AttendanceImportMode" NOT NULL DEFAULT 'MTD';

-- CreateIndex
CREATE INDEX "AttendanceImportBatch_importMode_periodMonth_status_idx" ON "AttendanceImportBatch"("importMode", "periodMonth", "status");
