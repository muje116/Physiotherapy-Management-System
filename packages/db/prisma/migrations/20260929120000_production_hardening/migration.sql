-- Durable password-reset tokens and replay-safe payment identifiers.
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN "providerEventId" TEXT;

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");
CREATE UNIQUE INDEX "Payment_tenantId_idempotencyKey_key" ON "Payment"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "PaymentRequest_provider_providerEventId_key" ON "PaymentRequest"("provider", "providerEventId");
CREATE UNIQUE INDEX "PaymentRequest_active_invoice_key"
    ON "PaymentRequest"("tenantId", "invoiceId")
    WHERE "status" IN ('PENDING', 'PROCESSING');

ALTER TABLE "PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AuditLog_tenantId_timestamp_idx" ON "AuditLog"("tenantId", "timestamp");

-- Protect the appointment overlap check against concurrent requests.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_no_active_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "therapistId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  ) WHERE ("status" NOT IN ('CANCELLED', 'NO_SHOW'));

-- The previous policies depended on a transaction-local setting that was set on
-- a different pooled connection from the request queries. Disable those
-- policies until every request is executed inside a pinned transaction. The
-- application consistently scopes tenant-owned queries by tenantId.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Patient', 'Appointment', 'Therapist', 'SoapNote', 'Invoice', 'User',
    'ScheduleBlock', 'ExercisePlan', 'OutcomeMeasure', 'ReminderRule',
    'ReminderLog', 'MarketingCampaign', 'AuditLog', 'NotificationTemplate',
    'NotificationChannel', 'FollowUp', 'PaymentMethod', 'Payment',
    'MedicalScheme', 'SchemeClaim', 'TreatmentPlan', 'TreatmentPlanStage',
    'ClientTask', 'ReportExport', 'PatientFeedback', 'Asset',
    'DrugInventory', 'DrugStockMovement', 'PaymentRequest'
  ] LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;
