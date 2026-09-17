import { z } from 'zod';
import { recordIdSchema } from './common';

export const createReminderRuleSchema = z.object({
  trigger: z.string().min(1),
  channel: z.array(z.enum(['SMS', 'EMAIL', 'WHATSAPP'])).min(1),
  template: z.string().min(1),
  isActive: z.boolean().default(true),
});

export const updateReminderRuleSchema = z.object({
  trigger: z.string().optional(),
  channel: z.array(z.enum(['SMS', 'EMAIL', 'WHATSAPP'])).optional(),
  template: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const manualSendSchema = z.object({
  recipientFilter: z.string().min(1),
  channel: z.enum(['SMS', 'EMAIL', 'WHATSAPP']),
  message: z.string().min(1),
});

export const reminderLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['SENT', 'FAILED', 'DELIVERED']).optional(),
});

export const followUpQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'CONTACTED', 'RESCHEDULED', 'CLOSED']).optional(),
  type: z.enum(['NO_SHOW', 'CANCELLED_SHORT_NOTICE', 'REENGAGEMENT']).optional(),
  patientId: recordIdSchema.optional(),
});

export const updateFollowUpSchema = z.object({
  status: z.enum(['PENDING', 'CONTACTED', 'RESCHEDULED', 'CLOSED']).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  contactedAt: z.coerce.date().nullable().optional(),
});

export type CreateReminderRuleInput = z.infer<typeof createReminderRuleSchema>;
export type UpdateReminderRuleInput = z.infer<typeof updateReminderRuleSchema>;
export type ManualSendInput = z.infer<typeof manualSendSchema>;
export type FollowUpQueryInput = z.infer<typeof followUpQuerySchema>;
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;
