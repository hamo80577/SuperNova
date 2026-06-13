-- Add Champ-related counters to attendance import batches.
-- matchedChampRows: rows matched to a Champ by ibsId.
-- ambiguousIdentifierRows: rows whose identifier matched both a Picker and a Champ.
ALTER TABLE "AttendanceImportBatch" ADD COLUMN "matchedChampRows" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AttendanceImportBatch" ADD COLUMN "ambiguousIdentifierRows" INTEGER NOT NULL DEFAULT 0;
