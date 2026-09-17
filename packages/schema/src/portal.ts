import { z } from 'zod';

export const submitFeedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
