import { z } from 'zod';
import { recordIdSchema } from './common';

export const reportPaymentStatusSchema = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']);

const reportQueryBaseSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: reportPaymentStatusSchema.optional(),
  paymentMethod: z.string().trim().min(1).optional(),
  memberStatus: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const reportQuerySchema = reportQueryBaseSchema.refine((value) => new Date(value.startDate) <= new Date(value.endDate), {
  message: 'startDate must be before or equal to endDate',
  path: ['endDate'],
});

export const reportDashboardQuerySchema = reportQueryBaseSchema.partial();

export const exportReportSchema = z.object({
  type: z.enum(['clinical', 'financial', 'operational', 'therapist', 'patients', 'members', 'payments']),
  format: z.enum(['pdf', 'csv']),
  therapistId: recordIdSchema.optional(),
  dateRange: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  }),
});

export type ExportReportInput = z.infer<typeof exportReportSchema>;
