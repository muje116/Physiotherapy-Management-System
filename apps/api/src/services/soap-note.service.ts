import { prisma, Role } from '@physiocore/db';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { PaginatedResult } from '../types';

interface SoapNoteQuery {
  page: number;
  limit: number;
  patientId?: string;
  therapistId?: string;
  startDate?: string;
  endDate?: string;
}

export async function list(tenantId: string, query: SoapNoteQuery): Promise<PaginatedResult<any>> {
  const where: any = { tenantId };

  if (query.patientId) where.patientId = query.patientId;
  if (query.therapistId) where.therapistId = query.therapistId;

  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = new Date(query.startDate);
    if (query.endDate) where.createdAt.lte = new Date(query.endDate);
  }

  const [items, total] = await Promise.all([
    prisma.soapNote.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        appointment: {
          select: {
            startAt: true,
            type: true,
            therapist: {
              select: {
                id: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.soapNote.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function create(tenantId: string, data: {
  appointmentId: string;
  patientId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icd10Codes?: string[];
  cptCodes?: string[];
  painScore?: number;
  complaint?: string;
  painLocation?: string;
  symptomsSince?: string;
  painPattern?: string;
  radiatesTo?: string;
  aggravatedBy?: string;
  easedBy?: string;
  medications?: string;
  imagingFindings?: string;
  dayNightSymptoms?: string;
  presentingHistory?: string;
  pastMedicalHistory?: string;
  palpationFindings?: string;
  rangeOfMotion?: string;
  treatmentProvided?: string;
}) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: data.appointmentId, tenantId },
  });
  if (!appointment) throw new NotFoundError('Appointment not found');
  if (appointment.patientId && appointment.patientId !== data.patientId) {
    throw new ValidationError('SOAP note patient does not match the appointment patient');
  }

  const existingNote = await prisma.soapNote.findUnique({
    where: { appointmentId: data.appointmentId },
  });
  if (existingNote) throw new NotFoundError('SOAP note already exists for this appointment');

  const soapNote = await prisma.soapNote.create({
    data: {
      tenantId,
      appointmentId: data.appointmentId,
      patientId: data.patientId,
      therapistId: appointment.therapistId,
      subjective: data.subjective,
      objective: data.objective,
      assessment: data.assessment,
      plan: data.plan,
      icd10Codes: data.icd10Codes || [],
      cptCodes: data.cptCodes || [],
      painScore: data.painScore,
      complaint: data.complaint,
      painLocation: data.painLocation,
      symptomsSince: data.symptomsSince,
      painPattern: data.painPattern,
      radiatesTo: data.radiatesTo,
      aggravatedBy: data.aggravatedBy,
      easedBy: data.easedBy,
      medications: data.medications,
      imagingFindings: data.imagingFindings,
      dayNightSymptoms: data.dayNightSymptoms,
      presentingHistory: data.presentingHistory,
      pastMedicalHistory: data.pastMedicalHistory,
      palpationFindings: data.palpationFindings,
      rangeOfMotion: data.rangeOfMotion,
      treatmentProvided: data.treatmentProvided,
    },
    include: {
      appointment: { select: { startAt: true, type: true } },
    },
  });

  return soapNote;
}

export async function getById(tenantId: string, soapNoteId: string) {
  const soapNote = await prisma.soapNote.findFirst({
    where: { id: soapNoteId, tenantId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
      appointment: {
        select: {
          id: true,
          startAt: true,
          endAt: true,
          type: true,
          status: true,
          therapist: {
            select: {
              id: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  if (!soapNote) throw new NotFoundError('SOAP note not found');
  return soapNote;
}

export async function update(tenantId: string, soapNoteId: string, data: any) {
  const soapNote = await prisma.soapNote.findFirst({ where: { id: soapNoteId, tenantId } });
  if (!soapNote) throw new NotFoundError('SOAP note not found');
  if (soapNote.signedAt) throw new ForbiddenError('Cannot update a signed SOAP note');

  const updateData: any = {};
  if (data.subjective !== undefined) updateData.subjective = data.subjective;
  if (data.objective !== undefined) updateData.objective = data.objective;
  if (data.assessment !== undefined) updateData.assessment = data.assessment;
  if (data.plan !== undefined) updateData.plan = data.plan;
  if (data.icd10Codes !== undefined) updateData.icd10Codes = data.icd10Codes;
  if (data.cptCodes !== undefined) updateData.cptCodes = data.cptCodes;
  if (data.painScore !== undefined) updateData.painScore = data.painScore;
  if (data.complaint !== undefined) updateData.complaint = data.complaint;
  if (data.painLocation !== undefined) updateData.painLocation = data.painLocation;
  if (data.symptomsSince !== undefined) updateData.symptomsSince = data.symptomsSince;
  if (data.painPattern !== undefined) updateData.painPattern = data.painPattern;
  if (data.radiatesTo !== undefined) updateData.radiatesTo = data.radiatesTo;
  if (data.aggravatedBy !== undefined) updateData.aggravatedBy = data.aggravatedBy;
  if (data.easedBy !== undefined) updateData.easedBy = data.easedBy;
  if (data.medications !== undefined) updateData.medications = data.medications;
  if (data.imagingFindings !== undefined) updateData.imagingFindings = data.imagingFindings;
  if (data.dayNightSymptoms !== undefined) updateData.dayNightSymptoms = data.dayNightSymptoms;
  if (data.presentingHistory !== undefined) updateData.presentingHistory = data.presentingHistory;
  if (data.pastMedicalHistory !== undefined) updateData.pastMedicalHistory = data.pastMedicalHistory;
  if (data.palpationFindings !== undefined) updateData.palpationFindings = data.palpationFindings;
  if (data.rangeOfMotion !== undefined) updateData.rangeOfMotion = data.rangeOfMotion;
  if (data.treatmentProvided !== undefined) updateData.treatmentProvided = data.treatmentProvided;

  return prisma.soapNote.update({
    where: { id: soapNoteId },
    data: updateData,
  });
}

export async function sign(tenantId: string, soapNoteId: string, userId: string) {
  const soapNote = await prisma.soapNote.findFirst({
    where: { id: soapNoteId, tenantId },
    include: { appointment: true },
  });
  if (!soapNote) throw new NotFoundError('SOAP note not found');
  if (soapNote.signedAt) throw new NotFoundError('SOAP note is already signed');

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw new NotFoundError('User not found');

  const therapist = await prisma.therapist.findFirst({
    where: { id: soapNote.therapistId, tenantId },
    select: { userId: true },
  });
  const isOwner = soapNote.therapistId === userId || therapist?.userId === userId;
  const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('Only the note author or an admin can sign this note');
  }

  return prisma.soapNote.update({
    where: { id: soapNoteId },
    data: {
      signedAt: new Date(),
      signedByUserId: userId,
    },
  });
}

export async function getSuggestions(_soapNoteId: string) {
  return {
    icd10Codes: [
      { code: 'M54.5', description: 'Low back pain' },
      { code: 'M25.50', description: 'Pain in unspecified joint' },
      { code: 'S93.4', description: 'Sprain of ankle' },
    ],
    cptCodes: [
      { code: '97110', description: 'Therapeutic exercises' },
      { code: '97140', description: 'Manual therapy' },
      { code: '97035', description: 'Ultrasound therapy' },
    ],
  };
}
