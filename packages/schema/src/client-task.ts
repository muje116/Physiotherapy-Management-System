import { z } from 'zod';
import { recordIdSchema } from './common';

const taskTypeSchema = z.enum(['EXERCISE', 'MEDICATION', 'READING', 'ASSESSMENT', 'OTHER']);
const taskStatusSchema = z.enum(['PENDING', 'SENT', 'COMPLETED', 'CANCELLED']);

export const createClientTaskSchema = z.object({
  patientId: recordIdSchema,
  therapistId: recordIdSchema.optional(),
  treatmentPlanId: recordIdSchema.optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  taskType: taskTypeSchema.default('EXERCISE'),
  dueDate: z.coerce.date().optional(),
  autoSendEmail: z.boolean().optional(),
});

export const updateClientTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  taskType: taskTypeSchema.optional(),
  dueDate: z.coerce.date().nullable().optional(),
  status: taskStatusSchema.optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export const clientTaskQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  patientId: recordIdSchema.optional(),
  status: taskStatusSchema.optional(),
  taskType: taskTypeSchema.optional(),
});

export type CreateClientTaskInput = z.infer<typeof createClientTaskSchema>;
export type UpdateClientTaskInput = z.infer<typeof updateClientTaskSchema>;
export type ClientTaskQueryInput = z.infer<typeof clientTaskQuerySchema>;
