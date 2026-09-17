import { z } from 'zod';

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  practiceNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  logoUrl: z.string().url().optional(),
});

export const updateSettingsSchema = z.object({
  appointmentDuration: z.number().int().positive().optional(),
  workingHoursStart: z.string().optional(),
  workingHoursEnd: z.string().optional(),
  workingDays: z.array(z.number().int().min(0).max(6)).optional(),
  defaultReminderRules: z.boolean().optional(),
  portalEnabled: z.boolean().optional(),
  telehealthEnabled: z.boolean().optional(),
});

export const updateIntegrationSchema = z.object({
  enabled: z.boolean(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;
