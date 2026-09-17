import { z } from 'zod';
import { recordIdSchema } from './common';

export const createTherapistSchema = z.object({
  userId: recordIdSchema,
  registrationNo: z.string().optional(),
  specialties: z.array(z.string()).default([]),
  bio: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const updateTherapistSchema = z.object({
  registrationNo: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

export const createScheduleBlockSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  type: z.enum(['AVAILABLE', 'BLOCKED', 'LEAVE', 'LUNCH']).default('AVAILABLE'),
  label: z.string().optional(),
});

export const scheduleQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export type CreateTherapistInput = z.infer<typeof createTherapistSchema>;
export type UpdateTherapistInput = z.infer<typeof updateTherapistSchema>;
export type CreateScheduleBlockInput = z.infer<typeof createScheduleBlockSchema>;
export type ScheduleQueryInput = z.infer<typeof scheduleQuerySchema>;
