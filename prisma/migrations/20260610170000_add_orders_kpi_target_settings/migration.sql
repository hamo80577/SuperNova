-- CreateTable
CREATE TABLE "OrdersKpiTargetSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "uhoRateTarget" DECIMAL(5,2) NOT NULL DEFAULT 8.00,
    "notOnTimeRateTarget" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "qcFailedRateTarget" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "partialRefundRateTarget" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "oosRateTarget" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "priceModifiedRateTarget" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdersKpiTargetSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrdersKpiTargetSettings_updatedByUserId_idx" ON "OrdersKpiTargetSettings"("updatedByUserId");
