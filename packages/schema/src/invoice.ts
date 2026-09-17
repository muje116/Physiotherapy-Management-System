import { z } from 'zod';
import { recordIdSchema } from './common';

export const medicalAidClaimStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'APPROVED',
  'REJECTED',
  'PAID',
]);

export const invoiceClaimStatusSchema = z.enum([
  'SUBMITTED',
  'ACKNOWLEDGED',
  'APPROVED',
  'REJECTED',
  'PAID',
]);

export const lineItemSchema = z.object({
  description: z.string().min(1),
  qty: z.number().positive(),
  unitPrice: z.number().positive(),
  total: z.number().positive(),
});

export const createInvoiceSchema = z.object({
  patientId: recordIdSchema,
  appointmentId: recordIdSchema.optional(),
  lineItems: z.array(lineItemSchema).min(1),
  dueDate: z.string().datetime().optional(),
  medicalAidClaim: z
    .object({
      claimReference: z.string().optional(),
      fundName: z.string().optional(),
      status: medicalAidClaimStatusSchema.optional(),
    })
    .optional(),
});

export const updateInvoiceSchema = z.object({
  lineItems: z.array(lineItemSchema).optional(),
  status: z
    .enum([
      'UNPAID',
      'PAID',
      'OVERDUE',
      'SUBMITTED_TO_MEDICAL_AID',
      'MEDICAL_AID_APPROVED',
      'MEDICAL_AID_REJECTED',
      'VOID',
    ])
    .optional(),
  paymentMethod: z.string().optional(),
  medicalAidClaim: z
    .object({
      claimReference: z.string().optional(),
      fundName: z.string().optional(),
      status: medicalAidClaimStatusSchema.optional(),
    })
    .optional(),
});

export const updateInvoiceClaimStatusSchema = z.object({
  status: invoiceClaimStatusSchema,
});

export const markInvoicePaidSchema = z.object({
  paymentMethod: z.string().trim().max(100).optional(),
});

export const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      'UNPAID',
      'PAID',
      'OVERDUE',
      'SUBMITTED_TO_MEDICAL_AID',
      'MEDICAL_AID_APPROVED',
      'MEDICAL_AID_REJECTED',
      'VOID',
    ])
    .optional(),
  patientId: recordIdSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;
export type UpdateInvoiceClaimStatusInput = z.infer<typeof updateInvoiceClaimStatusSchema>;
export type MarkInvoicePaidInput = z.infer<typeof markInvoicePaidSchema>;
