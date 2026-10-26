import { z } from 'zod';
import { recordIdSchema } from './common';

const claimStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'APPROVED', 'REJECTED', 'PAID']);

export const createMedicalSchemeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(80),
  tariffVersion: z.string().trim().max(80).optional(),
  contactNumber: z.string().trim().max(80).optional(),
  email: z.string().email().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export const updateMedicalSchemeSchema = createMedicalSchemeSchema.partial();

export const medicalSchemeClaimQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: claimStatusSchema.optional(),
  schemeId: recordIdSchema.optional(),
  patientId: recordIdSchema.optional(),
});

export const medicalSchemeReportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).superRefine((value, context) => {
  if (Boolean(value.startDate) !== Boolean(value.endDate)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startDate and endDate must be provided together',
      path: ['endDate'],
    });
    return;
  }

  if (value.startDate && value.endDate && new Date(value.startDate) > new Date(value.endDate)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startDate must be before or equal to endDate',
      path: ['endDate'],
    });
  }
});

export const createMedicalSchemeClaimSchema = z.object({
  invoiceId: recordIdSchema.optional(),
  patientId: recordIdSchema,
  schemeId: recordIdSchema,
  tariffCode: z.string().trim().max(80).optional(),
  amount: z.number().positive(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateMedicalSchemeClaimStatusSchema = z.object({
  status: claimStatusSchema,
  rejectionReason: z.string().trim().max(2000).optional(),
});

export type CreateMedicalSchemeInput = z.infer<typeof createMedicalSchemeSchema>;
export type UpdateMedicalSchemeInput = z.infer<typeof updateMedicalSchemeSchema>;
export type MedicalSchemeClaimQueryInput = z.infer<typeof medicalSchemeClaimQuerySchema>;
export type MedicalSchemeReportQueryInput = z.infer<typeof medicalSchemeReportQuerySchema>;
export type CreateMedicalSchemeClaimInput = z.infer<typeof createMedicalSchemeClaimSchema>;
