-- Enable RLS on all tenant-scoped tables
ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Therapist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SoapNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduleBlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExercisePlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutcomeMeasure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReminderRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReminderLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarketingCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies
CREATE POLICY tenant_isolation_patient ON "Patient" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_appointment ON "Appointment" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_therapist ON "Therapist" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_soapnote ON "SoapNote" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_invoice ON "Invoice" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_user ON "User" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_scheduleblock ON "ScheduleBlock" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_exerciseplan ON "ExercisePlan" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_outcomemeasure ON "OutcomeMeasure" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_reminderrule ON "ReminderRule" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_reminderlog ON "ReminderLog" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_campaign ON "MarketingCampaign" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_auditlog ON "AuditLog" USING ("tenantId" = current_setting('app.current_tenant_id')::text);

-- RLS for new models (notifications, payments, schemes, treatment)
ALTER TABLE "NotificationTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationChannel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FollowUp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentMethod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MedicalScheme" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchemeClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreatmentPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreatmentPlanStage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClientTask" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_notificationtemplate ON "NotificationTemplate" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_notificationchannel ON "NotificationChannel" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_followup ON "FollowUp" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_paymentmethod ON "PaymentMethod" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_payment ON "Payment" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_medicalscheme ON "MedicalScheme" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_schemeclaim ON "SchemeClaim" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_treatmentplan ON "TreatmentPlan" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_treatmentplanstage ON "TreatmentPlanStage" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
CREATE POLICY tenant_isolation_clienttask ON "ClientTask" USING ("tenantId" = current_setting('app.current_tenant_id')::text);
