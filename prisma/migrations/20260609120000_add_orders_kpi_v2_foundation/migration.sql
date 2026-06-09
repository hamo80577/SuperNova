-- CreateEnum
CREATE TYPE "OrdersKpiImportBatchStatus" AS ENUM ('VALIDATED', 'NEEDS_REVIEW', 'CONFIRMED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrdersKpiVendorMatchStatus" AS ENUM ('MATCHED_VENDOR', 'UNMAPPED_VENDOR_ID');

-- CreateEnum
CREATE TYPE "OrdersKpiPickerMatchStatus" AS ENUM ('MATCHED_PICKER', 'UNMATCHED_SHOPPER_ID', 'UNKNOWN_PICKER', 'MATCHED_USER_NOT_PICKER');

-- CreateEnum
CREATE TYPE "OrdersKpiIssueSeverity" AS ENUM ('WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "OrdersKpiIssueCode" AS ENUM ('MISSING_REQUIRED_COLUMNS', 'MISSING_DATE', 'INVALID_DATE', 'MISSING_VENDOR_ID', 'AMBIGUOUS_VENDOR_ID', 'INVALID_NUMERIC_METRIC', 'NEGATIVE_METRIC', 'UNSAFE_DUPLICATE_CONFLICT', 'UNMAPPED_VENDOR_ID', 'MISSING_SHOPPER_ID', 'NO_DATA_SHOPPER_ID', 'UNMATCHED_SHOPPER_ID', 'MATCHED_USER_NOT_PICKER', 'PREPARATION_TIME_MISSING', 'SUSPICIOUS_METRIC_VALUE');

-- CreateTable
CREATE TABLE "OrdersKpiImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "OrdersKpiImportBatchStatus" NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "confirmableRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "coveredDates" JSONB NOT NULL,
    "coveredDateFrom" TIMESTAMP(3),
    "coveredDateTo" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdersKpiImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdersKpiImportStagingRow" (
    "id" TEXT NOT NULL,
    "sourceBatchId" TEXT NOT NULL,
    "rawRowNumber" INTEGER NOT NULL,
    "rowHash" TEXT NOT NULL,
    "kpiDate" TIMESTAMP(3) NOT NULL,
    "sourceVendorId" TEXT NOT NULL,
    "matchedVendorId" TEXT,
    "matchedChainId" TEXT,
    "vendorNameSnapshot" TEXT,
    "chainNameSnapshot" TEXT,
    "vendorMatchStatus" "OrdersKpiVendorMatchStatus" NOT NULL,
    "sourceShopperId" TEXT,
    "sourcePickerKey" TEXT NOT NULL,
    "userId" TEXT,
    "pickerNameSnapshot" TEXT,
    "pickerMatchStatus" "OrdersKpiPickerMatchStatus" NOT NULL,
    "totalOrders" INTEGER NOT NULL,
    "successfulOrders" INTEGER NOT NULL,
    "qcFailedOrders" INTEGER NOT NULL,
    "vendorFailedOrders" INTEGER NOT NULL,
    "unhealthyOrders" INTEGER NOT NULL,
    "orderNotOnTime" INTEGER NOT NULL,
    "partialRefund" INTEGER NOT NULL,
    "vendorDelay" INTEGER NOT NULL,
    "preparationTime" DECIMAL(10,4),
    "outOfStock" INTEGER NOT NULL,
    "firNotOnTime" INTEGER NOT NULL,
    "priceModified" INTEGER NOT NULL,
    "issuesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdersKpiImportStagingRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdersKpiDailyRecord" (
    "id" TEXT NOT NULL,
    "sourceBatchId" TEXT NOT NULL,
    "kpiDate" TIMESTAMP(3) NOT NULL,
    "sourceVendorId" TEXT NOT NULL,
    "matchedVendorId" TEXT,
    "matchedChainId" TEXT,
    "vendorNameSnapshot" TEXT,
    "chainNameSnapshot" TEXT,
    "vendorMatchStatus" "OrdersKpiVendorMatchStatus" NOT NULL,
    "sourceShopperId" TEXT,
    "sourcePickerKey" TEXT NOT NULL,
    "userId" TEXT,
    "pickerNameSnapshot" TEXT,
    "pickerMatchStatus" "OrdersKpiPickerMatchStatus" NOT NULL,
    "totalOrders" INTEGER NOT NULL,
    "successfulOrders" INTEGER NOT NULL,
    "qcFailedOrders" INTEGER NOT NULL,
    "vendorFailedOrders" INTEGER NOT NULL,
    "unhealthyOrders" INTEGER NOT NULL,
    "orderNotOnTime" INTEGER NOT NULL,
    "partialRefund" INTEGER NOT NULL,
    "vendorDelay" INTEGER NOT NULL,
    "preparationTime" DECIMAL(10,4),
    "outOfStock" INTEGER NOT NULL,
    "firNotOnTime" INTEGER NOT NULL,
    "priceModified" INTEGER NOT NULL,
    "issuesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdersKpiDailyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdersKpiImportIssue" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "sourceVendorId" TEXT,
    "sourceShopperId" TEXT,
    "severity" "OrdersKpiIssueSeverity" NOT NULL,
    "issueCode" "OrdersKpiIssueCode" NOT NULL,
    "fieldName" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdersKpiImportIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrdersKpiImportBatch_status_idx" ON "OrdersKpiImportBatch"("status");

-- CreateIndex
CREATE INDEX "OrdersKpiImportBatch_uploadedAt_idx" ON "OrdersKpiImportBatch"("uploadedAt");

-- CreateIndex
CREATE INDEX "OrdersKpiImportBatch_coveredDateFrom_coveredDateTo_idx" ON "OrdersKpiImportBatch"("coveredDateFrom", "coveredDateTo");

-- CreateIndex
CREATE INDEX "OrdersKpiImportBatch_uploadedByUserId_idx" ON "OrdersKpiImportBatch"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportBatch_confirmedByUserId_idx" ON "OrdersKpiImportBatch"("confirmedByUserId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportBatch_fileHash_idx" ON "OrdersKpiImportBatch"("fileHash");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_sourceBatchId_idx" ON "OrdersKpiImportStagingRow"("sourceBatchId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_kpiDate_idx" ON "OrdersKpiImportStagingRow"("kpiDate");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_sourceVendorId_idx" ON "OrdersKpiImportStagingRow"("sourceVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_matchedVendorId_idx" ON "OrdersKpiImportStagingRow"("matchedVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_matchedChainId_idx" ON "OrdersKpiImportStagingRow"("matchedChainId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_sourceShopperId_idx" ON "OrdersKpiImportStagingRow"("sourceShopperId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_sourcePickerKey_idx" ON "OrdersKpiImportStagingRow"("sourcePickerKey");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_userId_idx" ON "OrdersKpiImportStagingRow"("userId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_kpiDate_sourceVendorId_idx" ON "OrdersKpiImportStagingRow"("kpiDate", "sourceVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_kpiDate_matchedVendorId_idx" ON "OrdersKpiImportStagingRow"("kpiDate", "matchedVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_kpiDate_matchedChainId_idx" ON "OrdersKpiImportStagingRow"("kpiDate", "matchedChainId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdersKpiImportStagingRow_sourceBatchId_rawRowNumber_key" ON "OrdersKpiImportStagingRow"("sourceBatchId", "rawRowNumber");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_sourceBatchId_idx" ON "OrdersKpiDailyRecord"("sourceBatchId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_kpiDate_idx" ON "OrdersKpiDailyRecord"("kpiDate");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_sourceVendorId_idx" ON "OrdersKpiDailyRecord"("sourceVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_matchedVendorId_idx" ON "OrdersKpiDailyRecord"("matchedVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_matchedChainId_idx" ON "OrdersKpiDailyRecord"("matchedChainId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_sourceShopperId_idx" ON "OrdersKpiDailyRecord"("sourceShopperId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_sourcePickerKey_idx" ON "OrdersKpiDailyRecord"("sourcePickerKey");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_userId_idx" ON "OrdersKpiDailyRecord"("userId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_kpiDate_sourceVendorId_idx" ON "OrdersKpiDailyRecord"("kpiDate", "sourceVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_kpiDate_matchedVendorId_idx" ON "OrdersKpiDailyRecord"("kpiDate", "matchedVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_kpiDate_matchedChainId_idx" ON "OrdersKpiDailyRecord"("kpiDate", "matchedChainId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_sourceVendorId_matchedVendorId_idx" ON "OrdersKpiDailyRecord"("sourceVendorId", "matchedVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_sourceShopperId_userId_idx" ON "OrdersKpiDailyRecord"("sourceShopperId", "userId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_userId_kpiDate_idx" ON "OrdersKpiDailyRecord"("userId", "kpiDate");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_vendorMatchStatus_idx" ON "OrdersKpiDailyRecord"("vendorMatchStatus");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_pickerMatchStatus_idx" ON "OrdersKpiDailyRecord"("pickerMatchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "OrdersKpiDailyRecord_kpiDate_sourceVendorId_sourcePickerKey_key" ON "OrdersKpiDailyRecord"("kpiDate", "sourceVendorId", "sourcePickerKey");

-- CreateIndex
CREATE INDEX "OrdersKpiImportIssue_batchId_idx" ON "OrdersKpiImportIssue"("batchId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportIssue_severity_idx" ON "OrdersKpiImportIssue"("severity");

-- CreateIndex
CREATE INDEX "OrdersKpiImportIssue_issueCode_idx" ON "OrdersKpiImportIssue"("issueCode");

-- CreateIndex
CREATE INDEX "OrdersKpiImportIssue_sourceVendorId_idx" ON "OrdersKpiImportIssue"("sourceVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportIssue_sourceShopperId_idx" ON "OrdersKpiImportIssue"("sourceShopperId");

-- AddForeignKey
ALTER TABLE "OrdersKpiImportBatch" ADD CONSTRAINT "OrdersKpiImportBatch_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiImportBatch" ADD CONSTRAINT "OrdersKpiImportBatch_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiImportBatch" ADD CONSTRAINT "OrdersKpiImportBatch_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiImportStagingRow" ADD CONSTRAINT "OrdersKpiImportStagingRow_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "OrdersKpiImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiImportStagingRow" ADD CONSTRAINT "OrdersKpiImportStagingRow_matchedVendorId_fkey" FOREIGN KEY ("matchedVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiImportStagingRow" ADD CONSTRAINT "OrdersKpiImportStagingRow_matchedChainId_fkey" FOREIGN KEY ("matchedChainId") REFERENCES "Chain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiImportStagingRow" ADD CONSTRAINT "OrdersKpiImportStagingRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiDailyRecord" ADD CONSTRAINT "OrdersKpiDailyRecord_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "OrdersKpiImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiDailyRecord" ADD CONSTRAINT "OrdersKpiDailyRecord_matchedVendorId_fkey" FOREIGN KEY ("matchedVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiDailyRecord" ADD CONSTRAINT "OrdersKpiDailyRecord_matchedChainId_fkey" FOREIGN KEY ("matchedChainId") REFERENCES "Chain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiDailyRecord" ADD CONSTRAINT "OrdersKpiDailyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiImportIssue" ADD CONSTRAINT "OrdersKpiImportIssue_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OrdersKpiImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
