ALTER TYPE "AttendanceImportBatchStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'UPLOADED';
ALTER TYPE "AttendanceImportBatchStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' BEFORE 'UPLOADED';

ALTER TYPE "OrdersKpiImportBatchStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'VALIDATED';
ALTER TYPE "OrdersKpiImportBatchStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' BEFORE 'VALIDATED';

ALTER TABLE "AttendanceImportBatch"
ADD COLUMN "jobId" TEXT,
ADD COLUMN "sourceFilePath" TEXT,
ADD COLUMN "failureReason" TEXT;

ALTER TABLE "OrdersKpiImportBatch"
ADD COLUMN "jobId" TEXT,
ADD COLUMN "sourceFilePath" TEXT,
ADD COLUMN "failureReason" TEXT;

CREATE UNIQUE INDEX "AttendanceImportBatch_jobId_key"
ON "AttendanceImportBatch"("jobId");

CREATE UNIQUE INDEX "OrdersKpiImportBatch_jobId_key"
ON "OrdersKpiImportBatch"("jobId");
