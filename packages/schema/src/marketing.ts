import { z } from 'zod';

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  channel: z.array(z.string()).min(1),
  template: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
});

export const updateCampaignSchema = z.object({
  name: z.string().optional(),
  channel: z.array(z.string()).optional(),
  template: z.string().optional(),
  status: z
    .enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'])
    .optional(),
  scheduledAt: z.string().datetime().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
