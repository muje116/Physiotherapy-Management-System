import { z } from 'zod';
import { recordIdSchema } from './common';

export const paymentRequestStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'REVERSED',
]);

export const createPaymentRequestSchema = z.object({
  invoiceId: recordIdSchema,
  amount: z.number().positive().optional(),
});

export const paymentRequestQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  invoiceId: recordIdSchema.optional(),
  patientId: recordIdSchema.optional(),
  status: paymentRequestStatusSchema.optional(),
});

export const oneKhusaWebhookSchema = z.object({
  connectorId: z.coerce.number().optional(),
  sourceAccountNumber: z.string().optional(),
  sourceAccountName: z.string().optional(),
  sourceInstitution: z.string().optional(),
  sourceReferenceNumber: z.string().optional(),
  beneficiaryAccountNumber: z.string().optional(),
  transactionReferenceNumber: z.string().optional(),
  transactionDescription: z.string().optional(),
  transactionAmount: z.coerce.number().nonnegative().optional(),
  transactionFee: z.coerce.number().nonnegative().optional(),
  transactionDate: z.string().optional(),
  transactionStatusCode: z.string().optional(),
  transactionCode: z.string().optional(),
  responseCode: z.string().optional(),
  metaData: z.object({
    timedAccountNumber: z.string().optional(),
    referenceNumber: z.string().optional(),
    sourceDescription: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

export type CreatePaymentRequestInput = z.infer<typeof createPaymentRequestSchema>;
export type PaymentRequestQueryInput = z.infer<typeof paymentRequestQuerySchema>;
export type OneKhusaWebhookInput = z.infer<typeof oneKhusaWebhookSchema>;
