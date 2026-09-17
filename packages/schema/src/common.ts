import { z } from 'zod';

export const uuidSchema = z.string().uuid();

// Database record ids are opaque strings so existing installations may use UUIDs,
// cuid-like values, or stable seeded ids.
export const recordIdSchema = z.string().trim().min(1).max(100);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z
      .object({
        page: z.number().int(),
        total: z.number().int(),
      })
      .optional(),
  });

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.any()).optional(),
  }),
});

export type PaginationParams = z.infer<typeof paginationSchema>;
export type DateRangeParams = z.infer<typeof dateRangeSchema>;
