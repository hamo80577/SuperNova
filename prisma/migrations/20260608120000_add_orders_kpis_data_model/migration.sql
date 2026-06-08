-- CreateEnum
CREATE TYPE "OrdersKpiImportBatchStatus" AS ENUM ('VALIDATED', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "OrdersKpiImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "OrdersKpiImportBatchStatus" NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "matchedRows" INTEGER NOT NULL DEFAULT 0,
    "unmatchedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdersKpiImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdersKpiImportStagingRow" (
    "id" TEXT NOT NULL,
    "sourceBatchId" TEXT NOT NULL,
    "kpiDate" TIMESTAMP(3) NOT NULL,
    "shopperId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pickerNameSnapshot" TEXT NOT NULL,
    "sourceVendorId" TEXT NOT NULL,
    "matchedVendorId" TEXT,
    "matchedChainId" TEXT,
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
    "successRate" DECIMAL(8,4),
    "unhealthyRate" DECIMAL(8,4),
    "notOnTimeRate" DECIMAL(8,4),
    "rawRowNumber" INTEGER NOT NULL,
    "rowHash" TEXT NOT NULL,
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
    "shopperId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pickerNameSnapshot" TEXT NOT NULL,
    "sourceVendorId" TEXT NOT NULL,
    "matchedVendorId" TEXT,
    "matchedChainId" TEXT,
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
    "successRate" DECIMAL(8,4),
    "unhealthyRate" DECIMAL(8,4),
    "notOnTimeRate" DECIMAL(8,4),
    "rawRowNumber" INTEGER NOT NULL,
    "rowHash" TEXT NOT NULL,
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
    "shopperId" TEXT,
    "severity" TEXT NOT NULL,
    "issueCode" TEXT NOT NULL,
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
CREATE INDEX "OrdersKpiImportBatch_dateFrom_dateTo_idx" ON "OrdersKpiImportBatch"("dateFrom", "dateTo");

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
CREATE INDEX "OrdersKpiImportStagingRow_shopperId_idx" ON "OrdersKpiImportStagingRow"("shopperId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_userId_idx" ON "OrdersKpiImportStagingRow"("userId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_matchedVendorId_idx" ON "OrdersKpiImportStagingRow"("matchedVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_matchedChainId_idx" ON "OrdersKpiImportStagingRow"("matchedChainId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportStagingRow_kpiDate_userId_idx" ON "OrdersKpiImportStagingRow"("kpiDate", "userId");

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
CREATE INDEX "OrdersKpiDailyRecord_shopperId_idx" ON "OrdersKpiDailyRecord"("shopperId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_userId_idx" ON "OrdersKpiDailyRecord"("userId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_matchedVendorId_idx" ON "OrdersKpiDailyRecord"("matchedVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_matchedChainId_idx" ON "OrdersKpiDailyRecord"("matchedChainId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_kpiDate_userId_idx" ON "OrdersKpiDailyRecord"("kpiDate", "userId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_kpiDate_matchedVendorId_idx" ON "OrdersKpiDailyRecord"("kpiDate", "matchedVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiDailyRecord_kpiDate_matchedChainId_idx" ON "OrdersKpiDailyRecord"("kpiDate", "matchedChainId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdersKpiDailyRecord_kpiDate_shopperId_sourceVendorId_key" ON "OrdersKpiDailyRecord"("kpiDate", "shopperId", "sourceVendorId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportIssue_batchId_idx" ON "OrdersKpiImportIssue"("batchId");

-- CreateIndex
CREATE INDEX "OrdersKpiImportIssue_severity_idx" ON "OrdersKpiImportIssue"("severity");

-- CreateIndex
CREATE INDEX "OrdersKpiImportIssue_issueCode_idx" ON "OrdersKpiImportIssue"("issueCode");

-- AddForeignKey
ALTER TABLE "OrdersKpiImportBatch" ADD CONSTRAINT "OrdersKpiImportBatch_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiImportBatch" ADD CONSTRAINT "OrdersKpiImportBatch_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiImportStagingRow" ADD CONSTRAINT "OrdersKpiImportStagingRow_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "OrdersKpiImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiImportStagingRow" ADD CONSTRAINT "OrdersKpiImportStagingRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiDailyRecord" ADD CONSTRAINT "OrdersKpiDailyRecord_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "OrdersKpiImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiDailyRecord" ADD CONSTRAINT "OrdersKpiDailyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdersKpiImportIssue" ADD CONSTRAINT "OrdersKpiImportIssue_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OrdersKpiImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
