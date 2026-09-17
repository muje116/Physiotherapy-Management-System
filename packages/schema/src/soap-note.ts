import { z } from 'zod';
import { recordIdSchema } from './common';

export const createSoapNoteSchema = z.object({
  appointmentId: recordIdSchema,
  patientId: recordIdSchema,
  subjective: z.string().min(1),
  objective: z.string().min(1),
  assessment: z.string().min(1),
  plan: z.string().min(1),
  icd10Codes: z.array(z.string()).default([]),
  cptCodes: z.array(z.string()).default([]),
  painScore: z.number().int().min(0).max(10).optional(),
  complaint: z.string().max(2000).optional(),
  painLocation: z.string().max(500).optional(),
  symptomsSince: z.string().max(250).optional(),
  painPattern: z.string().max(250).optional(),
  radiatesTo: z.string().max(500).optional(),
  aggravatedBy: z.string().max(1000).optional(),
  easedBy: z.string().max(1000).optional(),
  medications: z.string().max(1000).optional(),
  imagingFindings: z.string().max(2000).optional(),
  dayNightSymptoms: z.string().max(1000).optional(),
  presentingHistory: z.string().max(4000).optional(),
  pastMedicalHistory: z.string().max(4000).optional(),
  palpationFindings: z.string().max(2000).optional(),
  rangeOfMotion: z.string().max(2000).optional(),
  treatmentProvided: z.string().max(4000).optional(),
});

export const updateSoapNoteSchema = createSoapNoteSchema.partial();

export const soapNoteQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  patientId: recordIdSchema.optional(),
  therapistId: recordIdSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const signSoapNoteSchema = z.object({
  signature: z.string().min(1),
});

export type CreateSoapNoteInput = z.infer<typeof createSoapNoteSchema>;
export type UpdateSoapNoteInput = z.infer<typeof updateSoapNoteSchema>;
export type SoapNoteQueryInput = z.infer<typeof soapNoteQuerySchema>;
