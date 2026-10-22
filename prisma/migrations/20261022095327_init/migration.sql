-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('COMPLETED', 'HALTED');

-- CreateEnum
CREATE TYPE "Flag" AS ENUM ('STOCKOUT_RISK', 'OVERSTOCK', 'HIGH_DEMAND', 'WATCH', 'OK', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "RecStatus" AS ENUM ('PENDING', 'APPROVED', 'OVERRIDDEN', 'REJECTED');

-- CreateEnum
CREATE TYPE "DecisionAction" AS ENUM ('APPROVE', 'OVERRIDE', 'REJECT');

-- CreateEnum
CREATE TYPE "CheckResult" AS ENUM ('PROCEED', 'HOLD');

-- CreateTable
CREATE TABLE "Sku" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isPerishable" BOOLEAN NOT NULL,
    "standardReorderQty" INTEGER,
    "unitOfMeasure" TEXT,
    "unitPrice" DECIMAL(12,2),
    "casePack" INTEGER,
    "leadTimeWeeks" INTEGER,
    "primaryDistributorCode" TEXT,

    CONSTRAINT "Sku_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Distributor" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "status" TEXT,
    "tier" TEXT,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "WeeklySale" (
    "id" SERIAL NOT NULL,
    "skuCode" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "units" INTEGER NOT NULL,

    CONSTRAINT "WeeklySale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySnapshot" (
    "id" SERIAL NOT NULL,
    "skuCode" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "location" TEXT,
    "onHand" INTEGER NOT NULL,
    "onOrder" INTEGER,

    CONSTRAINT "InventorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Festival" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "region" TEXT,

    CONSTRAINT "Festival_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventFlag" (
    "id" SERIAL NOT NULL,
    "skuCode" TEXT,
    "distributorCode" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" SERIAL NOT NULL,
    "runDate" DATE NOT NULL,
    "status" "RunStatus" NOT NULL,
    "haltReason" TEXT,
    "configSnapshot" JSONB NOT NULL,
    "totals" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "skuCode" TEXT NOT NULL,
    "flag" "Flag" NOT NULL,
    "avg4" DOUBLE PRECISION NOT NULL,
    "avg12" DOUBLE PRECISION NOT NULL,
    "festivalFactor" DOUBLE PRECISION NOT NULL,
    "demandRate" DOUBLE PRECISION NOT NULL,
    "inventoryPosition" INTEGER NOT NULL,
    "weeksOfCover" DOUBLE PRECISION NOT NULL,
    "qty" INTEGER,
    "orderValue" DECIMAL(14,2),
    "reason" TEXT NOT NULL,
    "status" "RecStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecException" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "skuCode" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "detail" TEXT NOT NULL,

    CONSTRAINT "RecException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" SERIAL NOT NULL,
    "recommendationId" INTEGER NOT NULL,
    "action" "DecisionAction" NOT NULL,
    "newQty" INTEGER,
    "reasonCode" TEXT NOT NULL,
    "note" TEXT,
    "decidedBy" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreplacementCheck" (
    "id" SERIAL NOT NULL,
    "recommendationId" INTEGER NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" "CheckResult" NOT NULL,
    "triggers" JSONB NOT NULL,
    "ownerDecision" TEXT,
    "ownerNote" TEXT,

    CONSTRAINT "PreplacementCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklySale_skuCode_weekStart_idx" ON "WeeklySale"("skuCode", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySale_skuCode_weekStart_key" ON "WeeklySale"("skuCode", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySnapshot_skuCode_asOfDate_key" ON "InventorySnapshot"("skuCode", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "Festival_startDate_endDate_key" ON "Festival"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Recommendation_runId_flag_idx" ON "Recommendation"("runId", "flag");

-- CreateIndex
CREATE INDEX "RecException_runId_code_idx" ON "RecException"("runId", "code");

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_primaryDistributorCode_fkey" FOREIGN KEY ("primaryDistributorCode") REFERENCES "Distributor"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklySale" ADD CONSTRAINT "WeeklySale_skuCode_fkey" FOREIGN KEY ("skuCode") REFERENCES "Sku"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_skuCode_fkey" FOREIGN KEY ("skuCode") REFERENCES "Sku"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFlag" ADD CONSTRAINT "EventFlag_skuCode_fkey" FOREIGN KEY ("skuCode") REFERENCES "Sku"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFlag" ADD CONSTRAINT "EventFlag_distributorCode_fkey" FOREIGN KEY ("distributorCode") REFERENCES "Distributor"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_skuCode_fkey" FOREIGN KEY ("skuCode") REFERENCES "Sku"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecException" ADD CONSTRAINT "RecException_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecException" ADD CONSTRAINT "RecException_skuCode_fkey" FOREIGN KEY ("skuCode") REFERENCES "Sku"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreplacementCheck" ADD CONSTRAINT "PreplacementCheck_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
