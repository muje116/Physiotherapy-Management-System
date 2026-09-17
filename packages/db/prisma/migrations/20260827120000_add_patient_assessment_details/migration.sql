ALTER TABLE "Patient"
  ADD COLUMN "occupation" TEXT,
  ADD COLUMN "employer" TEXT,
  ADD COLUMN "clinic" TEXT,
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "paymentResponsibilityAcknowledged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "paymentResponsibilitySignedAt" TIMESTAMP(3),
  ADD COLUMN "nextOfKinName" TEXT,
  ADD COLUMN "nextOfKinPhone" TEXT,
  ADD COLUMN "howHeardAboutClinic" TEXT;

ALTER TABLE "SoapNote"
  ADD COLUMN "complaint" TEXT,
  ADD COLUMN "painLocation" TEXT,
  ADD COLUMN "symptomsSince" TEXT,
  ADD COLUMN "painPattern" TEXT,
  ADD COLUMN "radiatesTo" TEXT,
  ADD COLUMN "aggravatedBy" TEXT,
  ADD COLUMN "easedBy" TEXT,
  ADD COLUMN "medications" TEXT,
  ADD COLUMN "imagingFindings" TEXT,
  ADD COLUMN "dayNightSymptoms" TEXT,
  ADD COLUMN "presentingHistory" TEXT,
  ADD COLUMN "pastMedicalHistory" TEXT,
  ADD COLUMN "palpationFindings" TEXT,
  ADD COLUMN "rangeOfMotion" TEXT,
  ADD COLUMN "treatmentProvided" TEXT;
