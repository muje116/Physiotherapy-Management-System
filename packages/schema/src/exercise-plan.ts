import { z } from 'zod';
import { recordIdSchema } from './common';

export const createExercisePlanItemSchema = z.object({
  exerciseName: z.string().min(1),
  bodyRegion: z.string().optional(),
  sets: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  durationSecs: z.number().int().positive().optional(),
  frequency: z.string().optional(),
  notes: z.string().optional(),
  order: z.number().int().min(0).default(0),
});

export const createExercisePlanSchema = z.object({
  patientId: recordIdSchema,
  name: z.string().min(1).max(200),
  items: z.array(createExercisePlanItemSchema).default([]),
});

export const updateExercisePlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
});

export const updateExercisePlanItemSchema = createExercisePlanItemSchema.partial();

export type CreateExercisePlanInput = z.infer<typeof createExercisePlanSchema>;
export type UpdateExercisePlanInput = z.infer<typeof updateExercisePlanSchema>;
export type CreateExercisePlanItemInput = z.infer<typeof createExercisePlanItemSchema>;
export type UpdateExercisePlanItemInput = z.infer<typeof updateExercisePlanItemSchema>;
