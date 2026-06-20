ALTER TABLE "AttendanceImportBatch"
ADD COLUMN "previewResult" JSONB;

ALTER TABLE "OrdersKpiImportBatch"
ADD COLUMN "previewResult" JSONB;
