-- Champ Attendance Support V1
-- Extends attendance from PICKER-only to PICKER + CHAMP in the same import/report flow.
-- Adds generic person fields, keeps legacy picker fields backward-compatible, and
-- backfills existing rows as PICKER / SHOPPER_ID before enforcing NOT NULL.

-- CreateEnum
CREATE TYPE "AttendancePersonRole" AS ENUM ('PICKER', 'CHAMP');

-- CreateEnum
CREATE TYPE "AttendanceIdentifierType" AS ENUM ('SHOPPER_ID', 'IBS_ID');

-- AlterEnum
ALTER TYPE "AttendanceMatchStatus" ADD VALUE 'MATCHED_CHAMP';

-- AlterEnum
ALTER TYPE "AttendanceIssueCode" ADD VALUE 'AMBIGUOUS_ATTENDANCE_IDENTIFIER';

-- AlterTable: AttendanceDailyRecord (add generic person fields nullable, make shopperId nullable)
ALTER TABLE "AttendanceDailyRecord"
  ALTER COLUMN "shopperId" DROP NOT NULL,
  ADD COLUMN "personRole" "AttendancePersonRole" NOT NULL DEFAULT 'PICKER',
  ADD COLUMN "identifierType" "AttendanceIdentifierType" NOT NULL DEFAULT 'SHOPPER_ID',
  ADD COLUMN "identifierValue" TEXT,
  ADD COLUMN "personNameSnapshot" TEXT;

-- Backfill generic fields from legacy picker fields
UPDATE "AttendanceDailyRecord"
SET "identifierValue" = COALESCE("shopperId", ''),
    "personNameSnapshot" = "pickerNameSnapshot"
WHERE "identifierValue" IS NULL;

ALTER TABLE "AttendanceDailyRecord"
  ALTER COLUMN "identifierValue" SET NOT NULL,
  ALTER COLUMN "personNameSnapshot" SET NOT NULL;

-- AlterTable: AttendancePickerMonthlySummary
ALTER TABLE "AttendancePickerMonthlySummary"
  ALTER COLUMN "shopperId" DROP NOT NULL,
  ADD COLUMN "personRole" "AttendancePersonRole" NOT NULL DEFAULT 'PICKER',
  ADD COLUMN "identifierType" "AttendanceIdentifierType" NOT NULL DEFAULT 'SHOPPER_ID',
  ADD COLUMN "identifierValue" TEXT,
  ADD COLUMN "personNameSnapshot" TEXT;

UPDATE "AttendancePickerMonthlySummary"
SET "identifierValue" = COALESCE("shopperId", ''),
    "personNameSnapshot" = "pickerNameSnapshot"
WHERE "identifierValue" IS NULL;

ALTER TABLE "AttendancePickerMonthlySummary"
  ALTER COLUMN "identifierValue" SET NOT NULL,
  ALTER COLUMN "personNameSnapshot" SET NOT NULL;

-- CreateIndex
CREATE INDEX "AttendanceDailyRecord_identifierValue_idx" ON "AttendanceDailyRecord"("identifierValue");
CREATE INDEX "AttendanceDailyRecord_personRole_idx" ON "AttendanceDailyRecord"("personRole");
CREATE INDEX "AttendanceDailyRecord_periodMonth_personRole_idx" ON "AttendanceDailyRecord"("periodMonth", "personRole");
