import { prisma } from '@physiocore/db';
import { CreateClinicalObservationInput } from '@physiocore/schema';
import { NotFoundError } from '../utils/errors';

function decimal(value: number | undefined) {
  return value === undefined ? undefined : value;
}

export async function list(tenantId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId }, select: { id: true } });
  if (!patient) throw new NotFoundError('Patient not found');

  return prisma.clinicalObservation.findMany({
    where: { tenantId, patientId },
    include: {
      appointment: { select: { id: true, startAt: true, type: true } },
      recordedBy: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
    },
    orderBy: { recordedAt: 'desc' },
  });
}

export async function create(
  tenantId: string,
  patientId: string,
  recordedByUserId: string,
  data: CreateClinicalObservationInput,
) {
  const [patient, user] = await Promise.all([
    prisma.patient.findFirst({ where: { id: patientId, tenantId }, select: { id: true } }),
    prisma.user.findFirst({ where: { id: recordedByUserId, tenantId, isActive: true }, select: { id: true } }),
  ]);
  if (!patient) throw new NotFoundError('Patient not found');
  if (!user) throw new NotFoundError('Recording employee not found');

  if (data.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: data.appointmentId, tenantId, patientId },
      select: { id: true },
    });
    if (!appointment) throw new NotFoundError('Appointment not found for this patient');
  }

  return prisma.clinicalObservation.create({
    data: {
      tenantId,
      patientId,
      appointmentId: data.appointmentId,
      recordedByUserId,
      recordedAt: data.recordedAt ? new Date(data.recordedAt) : undefined,
      systolicBp: data.systolicBp,
      diastolicBp: data.diastolicBp,
      pulse: data.pulse,
      respiratoryRate: data.respiratoryRate,
      temperatureC: decimal(data.temperatureC),
      oxygenSaturation: data.oxygenSaturation,
      weightKg: decimal(data.weightKg),
      heightCm: decimal(data.heightCm),
      painScore: data.painScore,
      notes: data.notes?.trim() || null,
    },
    include: {
      appointment: { select: { id: true, startAt: true, type: true } },
      recordedBy: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
    },
  });
}
