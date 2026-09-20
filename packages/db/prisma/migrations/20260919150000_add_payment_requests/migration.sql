-- Durable OneKhusa request-to-pay records. The provider webhook remains the
-- authoritative confirmation, while the polling worker is a reconciliation fallback.
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ONEKHUSA',
    "providerReference" TEXT NOT NULL,
    "merchantAccountNumber" INTEGER,
    "timedAccountNumber" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "nextPollAt" TIMESTAMP(3),
    "providerTransactionReference" TEXT,
    "providerPaidAt" TIMESTAMP(3),
    "sourceAccountNumber" TEXT,
    "sourceInstitution" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment" ADD COLUMN "paymentRequestId" TEXT;

CREATE UNIQUE INDEX "PaymentRequest_tenantId_providerReference_key"
    ON "PaymentRequest"("tenantId", "providerReference");
CREATE INDEX "PaymentRequest_tenantId_invoiceId_status_idx"
    ON "PaymentRequest"("tenantId", "invoiceId", "status");
CREATE INDEX "PaymentRequest_tenantId_status_nextPollAt_idx"
    ON "PaymentRequest"("tenantId", "status", "nextPollAt");
CREATE INDEX "PaymentRequest_patientId_status_idx"
    ON "PaymentRequest"("patientId", "status");
CREATE UNIQUE INDEX "Payment_paymentRequestId_key"
    ON "Payment"("paymentRequestId");

ALTER TABLE "PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_paymentRequestId_fkey"
    FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_paymentrequest
    ON "PaymentRequest"
    USING ("tenantId" = current_setting('app.current_tenant_id')::text);
