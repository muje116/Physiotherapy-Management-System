import { z } from 'zod';
import { recordIdSchema } from './common';

const optionalNumber = (schema: z.ZodNumber) => schema.optional();

export const createClinicalObservationSchema = z.object({
  appointmentId: recordIdSchema.optional(),
  recordedAt: z.string().datetime().optional(),
  systolicBp: optionalNumber(z.number().int().min(40).max(300)),
  diastolicBp: optionalNumber(z.number().int().min(20).max(200)),
  pulse: optionalNumber(z.number().int().min(20).max(250)),
  respiratoryRate: optionalNumber(z.number().int().min(5).max(80)),
  temperatureC: optionalNumber(z.number().min(25).max(45)),
  oxygenSaturation: optionalNumber(z.number().int().min(0).max(100)),
  weightKg: optionalNumber(z.number().positive().max(1000)),
  heightCm: optionalNumber(z.number().positive().max(300)),
  painScore: optionalNumber(z.number().int().min(0).max(10)),
  notes: z.string().max(4000).optional(),
}).superRefine((value, context) => {
  if ((value.systolicBp === undefined) !== (value.diastolicBp === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['systolicBp'], message: 'Enter both blood pressure values' });
  }
  if (value.systolicBp !== undefined && value.diastolicBp !== undefined && value.diastolicBp >= value.systolicBp) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['diastolicBp'], message: 'Diastolic pressure must be below systolic pressure' });
  }
  const hasMeasurement = Object.entries(value).some(([key, item]) => key !== 'appointmentId' && key !== 'recordedAt' && key !== 'notes' && item !== undefined);
  if (!hasMeasurement && !value.notes?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['recordedAt'], message: 'Record at least one observation' });
  }
});

export type CreateClinicalObservationInput = z.infer<typeof createClinicalObservationSchema>;
