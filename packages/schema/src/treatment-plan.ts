import { z } from 'zod';
import { paginationSchema, recordIdSchema } from './common';

export const treatmentPlanStatusSchema = z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']);

const treatmentPlanGoalSchema = z.object({
  description: z.string().trim().min(1).max(1000),
  targetDate: z.string().max(50).optional(),
  achieved: z.boolean().optional(),
  achievedAt: z.string().datetime().optional(),
});

const treatmentPlanStageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  durationWeeks: z.coerce.number().int().min(0).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const createTreatmentPlanSchema = z.object({
  patientId: recordIdSchema,
  name: z.string().trim().min(1).max(200),
  diagnosis: z.string().trim().max(500).optional(),
  goals: z.array(treatmentPlanGoalSchema).optional(),
  startDate: z.coerce.date().optional(),
  notes: z.string().trim().max(5000).optional(),
  stages: z.array(treatmentPlanStageSchema).optional(),
});

export const updateTreatmentPlanSchema = createTreatmentPlanSchema.partial().omit({ patientId: true });

export const createTreatmentPlanStageSchema = treatmentPlanStageSchema;

export const updateTreatmentPlanStageSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  durationWeeks: z.coerce.number().int().min(0).optional(),
  order: z.coerce.number().int().min(0).optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
});

export const treatmentPlanQuerySchema = paginationSchema.extend({
  patientId: recordIdSchema.optional(),
  status: treatmentPlanStatusSchema.optional(),
});

export type CreateTreatmentPlanInput = z.infer<typeof createTreatmentPlanSchema>;
export type UpdateTreatmentPlanInput = z.infer<typeof updateTreatmentPlanSchema>;
export type CreateTreatmentPlanStageInput = z.infer<typeof createTreatmentPlanStageSchema>;
export type UpdateTreatmentPlanStageInput = z.infer<typeof updateTreatmentPlanStageSchema>;
export type TreatmentPlanQueryInput = z.infer<typeof treatmentPlanQuerySchema>;
