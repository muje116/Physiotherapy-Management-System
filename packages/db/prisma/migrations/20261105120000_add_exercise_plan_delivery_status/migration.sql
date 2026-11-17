CREATE TYPE "ExercisePlanSendStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'FAILED');

ALTER TABLE "ExercisePlan"
  ADD COLUMN "sendStatus" "ExercisePlanSendStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "sendError" TEXT;

UPDATE "ExercisePlan"
SET "sendStatus" = 'SENT'
WHERE "sentAt" IS NOT NULL;
