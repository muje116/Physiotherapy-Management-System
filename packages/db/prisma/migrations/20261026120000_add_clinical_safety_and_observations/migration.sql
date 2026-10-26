-- Structured clinical safety data keeps high-risk information visible outside free-text SOAP notes.
ALTER TABLE "Patient"
  ADD COLUMN "allergies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "chronicConditions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "currentMedications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bloodType" TEXT,
  ADD COLUMN "preferredLanguage" TEXT,
  ADD COLUMN "clinicalPrecautions" TEXT;

CREATE TABLE "ClinicalObservation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "recordedByUserId" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "systolicBp" INTEGER,
  "diastolicBp" INTEGER,
  "pulse" INTEGER,
  "respiratoryRate" INTEGER,
  "temperatureC" DECIMAL(4,1),
  "oxygenSaturation" INTEGER,
  "weightKg" DECIMAL(6,2),
  "heightCm" DECIMAL(5,2),
  "painScore" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClinicalObservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClinicalObservation_tenantId_patientId_recordedAt_idx"
  ON "ClinicalObservation"("tenantId", "patientId", "recordedAt");
CREATE INDEX "ClinicalObservation_tenantId_appointmentId_idx"
  ON "ClinicalObservation"("tenantId", "appointmentId");

ALTER TABLE "ClinicalObservation"
  ADD CONSTRAINT "ClinicalObservation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ClinicalObservation_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ClinicalObservation_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ClinicalObservation_recordedByUserId_fkey"
  FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClinicalObservation"
  ADD CONSTRAINT "ClinicalObservation_systolicBp_check"
    CHECK ("systolicBp" IS NULL OR "systolicBp" BETWEEN 40 AND 300),
  ADD CONSTRAINT "ClinicalObservation_diastolicBp_check"
    CHECK ("diastolicBp" IS NULL OR "diastolicBp" BETWEEN 20 AND 200),
  ADD CONSTRAINT "ClinicalObservation_bloodPressure_check"
    CHECK ("systolicBp" IS NULL OR "diastolicBp" IS NULL OR "diastolicBp" < "systolicBp"),
  ADD CONSTRAINT "ClinicalObservation_pulse_check"
    CHECK ("pulse" IS NULL OR "pulse" BETWEEN 20 AND 250),
  ADD CONSTRAINT "ClinicalObservation_respiratoryRate_check"
    CHECK ("respiratoryRate" IS NULL OR "respiratoryRate" BETWEEN 5 AND 80),
  ADD CONSTRAINT "ClinicalObservation_temperatureC_check"
    CHECK ("temperatureC" IS NULL OR "temperatureC" BETWEEN 25 AND 45),
  ADD CONSTRAINT "ClinicalObservation_oxygenSaturation_check"
    CHECK ("oxygenSaturation" IS NULL OR "oxygenSaturation" BETWEEN 0 AND 100),
  ADD CONSTRAINT "ClinicalObservation_weightKg_check"
    CHECK ("weightKg" IS NULL OR "weightKg" > 0),
  ADD CONSTRAINT "ClinicalObservation_heightCm_check"
    CHECK ("heightCm" IS NULL OR "heightCm" > 0),
  ADD CONSTRAINT "ClinicalObservation_painScore_check"
    CHECK ("painScore" IS NULL OR "painScore" BETWEEN 0 AND 10);

