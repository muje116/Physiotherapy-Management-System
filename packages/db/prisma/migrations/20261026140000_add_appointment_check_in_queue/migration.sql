-- Front-desk check-in and treatment-room handoff for the daily waiting queue.
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'CHECKED_IN' AFTER 'CONFIRMED';

ALTER TABLE "Appointment"
  ADD COLUMN "checkedInAt" TIMESTAMP(3),
  ADD COLUMN "room" TEXT,
  ADD COLUMN "queuePriority" TEXT NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_queuePriority_check"
  CHECK ("queuePriority" IN ('STANDARD', 'URGENT'));

CREATE INDEX "Appointment_tenantId_status_checkedInAt_idx"
  ON "Appointment"("tenantId", "status", "checkedInAt");
