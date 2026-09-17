import { z } from 'zod';
import { recordIdSchema } from './common';

export const paymentStatusSchema = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']);

export const paymentMethodTypeSchema = z.enum(['CASH', 'CARD', 'EFT', 'DEBIT_ORDER', 'MEDICAL_AID']);

export const recordPaymentSchema = z.object({
  patientId: recordIdSchema,
  invoiceId: recordIdSchema.optional(),
  amount: z.coerce.number().positive(),
  paymentMethodId: recordIdSchema.optional(),
  methodName: z.string().trim().min(1).max(100).optional(),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  patientId: recordIdSchema.optional(),
  invoiceId: recordIdSchema.optional(),
  status: paymentStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const createPaymentMethodSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: paymentMethodTypeSchema,
  feePercent: z.coerce.number().min(0).max(100).optional(),
  feePercentage: z.coerce.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

export const updatePaymentMethodSchema = createPaymentMethodSchema.partial();

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type PaymentQueryInput = z.infer<typeof paymentQuerySchema>;
export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;
