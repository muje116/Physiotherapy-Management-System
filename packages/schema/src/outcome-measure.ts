import { z } from 'zod';

const outcomeMeasureFields = {
  type: z.string().trim().min(1).max(100),
  score: z.coerce.number().finite().min(0),
  maxScore: z.coerce.number().finite().positive(),
  notes: z.string().trim().max(2000).optional(),
  recordedAt: z.coerce.date().optional(),
};

export const createOutcomeMeasureSchema = z.object(outcomeMeasureFields).superRefine((value, context) => {
  if (value.score > value.maxScore) {
    context.addIssue({ code: z.ZodIssueCode.too_big, maximum: value.maxScore, type: 'number', inclusive: true, path: ['score'], message: 'Score cannot exceed the maximum score' });
  }
});

export const updateOutcomeMeasureSchema = z.object({
  type: outcomeMeasureFields.type.optional(),
  score: outcomeMeasureFields.score.optional(),
  maxScore: outcomeMeasureFields.maxScore.optional(),
  notes: outcomeMeasureFields.notes,
  recordedAt: outcomeMeasureFields.recordedAt,
});

export type CreateOutcomeMeasureInput = z.infer<typeof createOutcomeMeasureSchema>;
export type UpdateOutcomeMeasureInput = z.infer<typeof updateOutcomeMeasureSchema>;
