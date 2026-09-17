CREATE TABLE "PatientFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientFeedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PatientFeedback_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE INDEX "PatientFeedback_tenantId_createdAt_idx" ON "PatientFeedback"("tenantId", "createdAt");

ALTER TABLE "PatientFeedback"
    ADD CONSTRAINT "PatientFeedback_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PatientFeedback"
    ADD CONSTRAINT "PatientFeedback_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PatientFeedback" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_patientfeedback
    ON "PatientFeedback"
    USING ("tenantId" = current_setting('app.current_tenant_id')::text);
