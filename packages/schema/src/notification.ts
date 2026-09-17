import { z } from 'zod';

const notificationChannelSchema = z.enum(['SMS', 'EMAIL', 'WHATSAPP']);

export const createNotificationTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  trigger: z.string().trim().min(1).max(100),
  channel: z.array(notificationChannelSchema).min(1),
  subject: z.string().trim().max(300).optional(),
  body: z.string().trim().min(1).max(10000),
  isActive: z.boolean().default(true),
});

export const updateNotificationTemplateSchema = createNotificationTemplateSchema.partial();

export const createNotificationChannelSchema = z.object({
  type: z.enum(['TWILIO_SMS', 'TWILIO_WHATSAPP', 'RESEND_EMAIL']),
  apiKey: z.string().trim().max(500).optional(),
  from: z.string().trim().max(320).optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateNotificationChannelSchema = createNotificationChannelSchema.omit({ type: true }).partial();

export type CreateNotificationTemplateInput = z.infer<typeof createNotificationTemplateSchema>;
export type UpdateNotificationTemplateInput = z.infer<typeof updateNotificationTemplateSchema>;
export type CreateNotificationChannelInput = z.infer<typeof createNotificationChannelSchema>;
export type UpdateNotificationChannelInput = z.infer<typeof updateNotificationChannelSchema>;
