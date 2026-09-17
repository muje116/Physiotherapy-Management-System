CREATE TABLE "ReportExport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileData" BYTEA,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportExport_tenantId_createdAt_idx" ON "ReportExport"("tenantId", "createdAt");

ALTER TABLE "ReportExport"
    ADD CONSTRAINT "ReportExport_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReportExport" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_reportexport
    ON "ReportExport"
    USING ("tenantId" = current_setting('app.current_tenant_id')::text);
