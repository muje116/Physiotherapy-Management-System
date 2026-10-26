import { z } from 'zod';
import { recordIdSchema } from './common';

export const createPatientSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  dateOfBirth: z.string().datetime(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  medicalAidName: z.string().optional(),
  medicalAidNo: z.string().optional(),
  referralSource: z.string().optional(),
  referralDoctorName: z.string().optional(),
  occupation: z.string().max(100).optional(),
  employer: z.string().max(150).optional(),
  clinic: z.string().max(150).optional(),
  paymentMethod: z.enum(['CASH', 'INSURANCE']).optional(),
  paymentResponsibilityAcknowledged: z.boolean().optional(),
  nextOfKinName: z.string().max(100).optional(),
  nextOfKinPhone: z.string().max(50).optional(),
  howHeardAboutClinic: z.string().max(150).optional(),
  allergies: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  chronicConditions: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  currentMedications: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  bloodType: z.string().trim().max(20).optional(),
  preferredLanguage: z.string().trim().max(100).optional(),
  clinicalPrecautions: z.string().max(4000).optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const patientQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  therapistId: recordIdSchema.optional(),
  isActive: z.coerce.boolean().optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientQueryInput = z.infer<typeof patientQuerySchema>;
