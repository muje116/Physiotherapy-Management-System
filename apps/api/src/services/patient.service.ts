import { prisma, Prisma, Role } from '@physiocore/db';
import { NotFoundError } from '../utils/errors';
import { generatePatientCode } from '../utils/helpers';
import { PaginatedResult } from '../types';

interface PatientQuery {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  therapistId?: string;
  isActive?: boolean;
}

function buildPatientFilter(tenantId: string, userId?: string, userRole?: string): any {
  const where: any = { tenantId };
  if (userRole === Role.THERAPIST && userId) {
    where.therapists = { some: { therapist: { userId, tenantId } } };
  }
  return where;
}

export async function list(tenantId: string, query: PatientQuery, userId?: string, userRole?: string): Promise<PaginatedResult<any>> {
  const where = buildPatientFilter(tenantId, userId, userRole);

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (query.therapistId && userRole !== Role.THERAPIST) {
    where.therapists = { some: { therapist: { id: query.therapistId, tenantId } } };
  }

  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { patientCode: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        therapists: { include: { therapist: { include: { user: { select: { firstName: true, lastName: true } } } } } },
        _count: { select: { appointments: true, invoices: true } },
      },
    }),
    prisma.patient.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function create(tenantId: string, data: any) {
  const patientCode = await generatePatientCode(tenantId);

  const patient = await prisma.patient.create({
    data: {
      tenantId,
      patientCode,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      phone: data.phone,
      email: data.email,
      address: data.address || undefined,
      medicalAidName: data.medicalAidName,
      medicalAidNo: data.medicalAidNo,
      referralSource: data.referralSource,
      referralDoctorName: data.referralDoctorName,
      occupation: data.occupation,
      employer: data.employer,
      clinic: data.clinic,
      paymentMethod: data.paymentMethod,
      paymentResponsibilityAcknowledged: data.paymentResponsibilityAcknowledged ?? false,
      paymentResponsibilitySignedAt: data.paymentResponsibilityAcknowledged ? new Date() : undefined,
      nextOfKinName: data.nextOfKinName,
      nextOfKinPhone: data.nextOfKinPhone,
      howHeardAboutClinic: data.howHeardAboutClinic,
    },
  });

  return patient;
}

export async function getById(tenantId: string, patientId: string, userId?: string, userRole?: string) {
  const where = { id: patientId, ...buildPatientFilter(tenantId, userId, userRole) };

  const patient = await prisma.patient.findFirst({
    where,
    include: {
      therapists: { include: { therapist: { include: { user: { select: { firstName: true, lastName: true } } } } } },
      _count: { select: { appointments: true, invoices: true, soapNotes: true, exercisePlans: true, outcomeMeasures: true } },
    },
  });

  if (!patient) throw new NotFoundError('Patient not found');
  return patient;
}

export async function update(tenantId: string, patientId: string, data: any, userId?: string, userRole?: string) {
  const where = { id: patientId, ...buildPatientFilter(tenantId, userId, userRole) };
  const patient = await prisma.patient.findFirst({ where });
  if (!patient) throw new NotFoundError('Patient not found');

  const updateData: any = {};
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth);
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.medicalAidName !== undefined) updateData.medicalAidName = data.medicalAidName;
  if (data.medicalAidNo !== undefined) updateData.medicalAidNo = data.medicalAidNo;
  if (data.referralSource !== undefined) updateData.referralSource = data.referralSource;
  if (data.referralDoctorName !== undefined) updateData.referralDoctorName = data.referralDoctorName;
  if (data.occupation !== undefined) updateData.occupation = data.occupation;
  if (data.employer !== undefined) updateData.employer = data.employer;
  if (data.clinic !== undefined) updateData.clinic = data.clinic;
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
  if (data.paymentResponsibilityAcknowledged !== undefined) {
    updateData.paymentResponsibilityAcknowledged = data.paymentResponsibilityAcknowledged;
    updateData.paymentResponsibilitySignedAt = data.paymentResponsibilityAcknowledged
      ? (patient.paymentResponsibilityAcknowledged ? patient.paymentResponsibilitySignedAt : new Date())
      : null;
  }
  if (data.nextOfKinName !== undefined) updateData.nextOfKinName = data.nextOfKinName;
  if (data.nextOfKinPhone !== undefined) updateData.nextOfKinPhone = data.nextOfKinPhone;
  if (data.howHeardAboutClinic !== undefined) updateData.howHeardAboutClinic = data.howHeardAboutClinic;

  const updated = await prisma.patient.update({
    where: { id: patientId },
    data: updateData,
  });

  return updated;
}

export async function softDelete(tenantId: string, patientId: string, userId?: string, userRole?: string) {
  const where = { id: patientId, ...buildPatientFilter(tenantId, userId, userRole) };
  const patient = await prisma.patient.findFirst({ where });
  if (!patient) throw new NotFoundError('Patient not found');

  return prisma.patient.update({
    where: { id: patientId },
    data: { isActive: false },
  });
}

async function verifyPatientAccess(tenantId: string, patientId: string, userId?: string, userRole?: string) {
  const where = { id: patientId, ...buildPatientFilter(tenantId, userId, userRole) };
  const patient = await prisma.patient.findFirst({ where });
  if (!patient) throw new NotFoundError('Patient not found');
  return patient;
}

export async function getAppointments(tenantId: string, patientId: string, userId?: string, userRole?: string) {
  await verifyPatientAccess(tenantId, patientId, userId, userRole);
  return prisma.appointment.findMany({
    where: { patientId, tenantId },
    include: { therapist: { include: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: { startAt: 'desc' },
  });
}

export async function getSoapNotes(tenantId: string, patientId: string, userId?: string, userRole?: string) {
  await verifyPatientAccess(tenantId, patientId, userId, userRole);
  return prisma.soapNote.findMany({
    where: { patientId, tenantId },
    include: {
      appointment: {
        select: {
          id: true,
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
    orderBy: { createdAt: 'desc' },
  });
}

export async function getInvoices(tenantId: string, patientId: string, userId?: string, userRole?: string) {
  await verifyPatientAccess(tenantId, patientId, userId, userRole);
  return prisma.invoice.findMany({
    where: { patientId, tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getExercisePlans(tenantId: string, patientId: string, userId?: string, userRole?: string) {
  await verifyPatientAccess(tenantId, patientId, userId, userRole);
  return prisma.exercisePlan.findMany({
    where: { patientId, tenantId },
    include: { items: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOutcomeMeasures(tenantId: string, patientId: string, userId?: string, userRole?: string) {
  await verifyPatientAccess(tenantId, patientId, userId, userRole);
  return prisma.outcomeMeasure.findMany({
    where: { patientId, tenantId },
    orderBy: { recordedAt: 'desc' },
  });
}

export async function getTimeline(tenantId: string, patientId: string, userId?: string, userRole?: string) {
  await verifyPatientAccess(tenantId, patientId, userId, userRole);

  const [appointments, notes, invoices, exercisePlans, treatmentPlans, outcomeMeasures, payments, clientTasks] = await Promise.all([
    prisma.appointment.findMany({ where: { patientId, tenantId } }),
    prisma.soapNote.findMany({ where: { patientId, tenantId } }),
    prisma.invoice.findMany({ where: { patientId, tenantId } }),
    prisma.exercisePlan.findMany({ where: { patientId, tenantId }, include: { items: true } }),
    prisma.treatmentPlan.findMany({ where: { patientId, tenantId } }),
    prisma.outcomeMeasure.findMany({ where: { patientId, tenantId } }),
    prisma.payment.findMany({ where: { patientId, tenantId } }),
    prisma.clientTask.findMany({ where: { patientId, tenantId } }),
  ]);

  const timeline: any[] = [];

  appointments.forEach((a) =>
    timeline.push({ type: 'appointment', date: a.startAt, data: a })
  );
  notes.forEach((n) =>
    timeline.push({ type: 'soap_note', date: n.createdAt, data: n })
  );
  invoices.forEach((i) =>
    timeline.push({ type: 'invoice', date: i.createdAt, data: i })
  );
  exercisePlans.forEach((ep) =>
    timeline.push({ type: 'exercise_plan', date: ep.createdAt, data: ep })
  );
  treatmentPlans.forEach((plan) =>
    timeline.push({ type: 'treatment_plan', date: plan.createdAt, data: plan })
  );
  outcomeMeasures.forEach((measure) =>
    timeline.push({ type: 'outcome_measure', date: measure.recordedAt, data: measure })
  );
  payments.forEach((payment) =>
    timeline.push({ type: 'payment', date: payment.paidAt || payment.createdAt, data: payment })
  );
  clientTasks.forEach((task) =>
    timeline.push({ type: 'client_task', date: task.createdAt, data: task })
  );

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return timeline;
}
