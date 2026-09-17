import { z } from 'zod';
import { recordIdSchema } from './common';

export const createAppointmentSchema = z.object({
  patientId: recordIdSchema,
  therapistId: recordIdSchema,
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  type: z.enum([
    'INITIAL_ASSESSMENT',
    'FOLLOW_UP',
    'MANUAL_THERAPY',
    'EXERCISE_PRESCRIPTION',
    'TELEHEALTH',
    'GROUP_SESSION',
  ]),
  isTelehealth: z.boolean().default(false),
  notes: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  type: z
    .enum([
      'INITIAL_ASSESSMENT',
      'FOLLOW_UP',
      'MANUAL_THERAPY',
      'EXERCISE_PRESCRIPTION',
      'TELEHEALTH',
      'GROUP_SESSION',
    ])
    .optional(),
  status: z
    .enum([
      'SCHEDULED',
      'CONFIRMED',
      'IN_SESSION',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW',
    ])
    .optional(),
  notes: z.string().optional(),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const appointmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  therapistId: recordIdSchema.optional(),
  status: z
    .enum([
      'SCHEDULED',
      'CONFIRMED',
      'IN_SESSION',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW',
    ])
    .optional(),
});

export const availableSlotsQuerySchema = z.object({
  therapistId: recordIdSchema,
  date: z.string().datetime(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type AppointmentQueryInput = z.infer<typeof appointmentQuerySchema>;
export type AvailableSlotsQueryInput = z.infer<typeof availableSlotsQuerySchema>;
