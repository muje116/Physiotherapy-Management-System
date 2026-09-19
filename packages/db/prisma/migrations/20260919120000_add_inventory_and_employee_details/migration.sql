-- Employee profile details
ALTER TABLE "User"
    ADD COLUMN "employeeNumber" TEXT,
    ADD COLUMN "jobTitle" TEXT,
    ADD COLUMN "department" TEXT,
    ADD COLUMN "phone" TEXT,
    ADD COLUMN "hireDate" TIMESTAMP(3);

-- Asset lifecycle tracking
CREATE TYPE "AssetStatus" AS ENUM ('IN_SERVICE', 'MAINTENANCE', 'RETIRED', 'LOST');

CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "serialNumber" TEXT,
    "location" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'IN_SERVICE',
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" DECIMAL(12,2),
    "warrantyExpiresAt" TIMESTAMP(3),
    "assignedToUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Asset_tenantId_assetTag_key" ON "Asset"("tenantId", "assetTag");
CREATE INDEX "Asset_tenantId_status_idx" ON "Asset"("tenantId", "status");

ALTER TABLE "Asset"
    ADD CONSTRAINT "Asset_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Asset"
    ADD CONSTRAINT "Asset_assignedToUserId_fkey"
    FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Batch-level drug inventory and an immutable stock movement ledger
CREATE TABLE "DrugInventory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "strength" TEXT,
    "dosageForm" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "batchNumber" TEXT NOT NULL DEFAULT 'UNSPECIFIED',
    "expiryDate" TIMESTAMP(3),
    "supplier" TEXT,
    "storageLocation" TEXT,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DrugInventory_tenantId_name_strength_batchNumber_key"
    ON "DrugInventory"("tenantId", "name", "strength", "batchNumber");
CREATE INDEX "DrugInventory_tenantId_expiryDate_idx"
    ON "DrugInventory"("tenantId", "expiryDate");

ALTER TABLE "DrugInventory"
    ADD CONSTRAINT "DrugInventory_quantityOnHand_check" CHECK ("quantityOnHand" >= 0);

CREATE TABLE "DrugStockMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "drugInventoryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "patientId" TEXT,
    "recipientUserId" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugStockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DrugStockMovement_tenantId_createdAt_idx"
    ON "DrugStockMovement"("tenantId", "createdAt");
CREATE INDEX "DrugStockMovement_tenantId_patientId_createdAt_idx"
    ON "DrugStockMovement"("tenantId", "patientId", "createdAt");
CREATE INDEX "DrugStockMovement_drugInventoryId_createdAt_idx"
    ON "DrugStockMovement"("drugInventoryId", "createdAt");

ALTER TABLE "DrugStockMovement"
    ADD CONSTRAINT "DrugStockMovement_quantity_check" CHECK ("quantity" > 0);

ALTER TABLE "DrugInventory"
    ADD CONSTRAINT "DrugInventory_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DrugStockMovement"
    ADD CONSTRAINT "DrugStockMovement_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DrugStockMovement"
    ADD CONSTRAINT "DrugStockMovement_drugInventoryId_fkey"
    FOREIGN KEY ("drugInventoryId") REFERENCES "DrugInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DrugStockMovement"
    ADD CONSTRAINT "DrugStockMovement_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DrugStockMovement"
    ADD CONSTRAINT "DrugStockMovement_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DrugStockMovement"
    ADD CONSTRAINT "DrugStockMovement_recordedByUserId_fkey"
    FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Asset" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_asset
    ON "Asset"
    USING ("tenantId" = current_setting('app.current_tenant_id')::text);

ALTER TABLE "DrugInventory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_druginventory
    ON "DrugInventory"
    USING ("tenantId" = current_setting('app.current_tenant_id')::text);

ALTER TABLE "DrugStockMovement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_drugstockmovement
    ON "DrugStockMovement"
    USING ("tenantId" = current_setting('app.current_tenant_id')::text);
