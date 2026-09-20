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
      _count: { select: { appointments: true, invoices: true, soapNotes: true, exercisePlans: true, outcomeMeasures: true, drugIssues: true } },
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

export async function getHistory(tenantId: string, patientId: string, userId?: string, userRole?: string) {
  await verifyPatientAccess(tenantId, patientId, userId, userRole);

  const [appointments, notes, invoices, exercisePlans, treatmentPlans, outcomeMeasures, payments, paymentRequests, clientTasks, schemeClaims, followUps, reminderLogs, feedback, drugIssues] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId, tenantId },
      include: { therapist: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { startAt: 'desc' },
    }),
    prisma.soapNote.findMany({
      where: { patientId, tenantId },
      include: { appointment: { include: { therapist: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({ where: { patientId, tenantId }, orderBy: { createdAt: 'desc' } }),
    prisma.exercisePlan.findMany({ where: { patientId, tenantId }, include: { items: true }, orderBy: { createdAt: 'desc' } }),
    prisma.treatmentPlan.findMany({ where: { patientId, tenantId }, include: { stages: { orderBy: { order: 'asc' } } }, orderBy: { createdAt: 'desc' } }),
    prisma.outcomeMeasure.findMany({ where: { patientId, tenantId }, orderBy: { recordedAt: 'desc' } }),
    prisma.payment.findMany({ where: { patientId, tenantId }, include: { paymentMethod: true }, orderBy: { paidAt: 'desc' } }),
    prisma.paymentRequest.findMany({ where: { patientId, tenantId }, include: { invoice: true }, orderBy: { createdAt: 'desc' } }),
    prisma.clientTask.findMany({ where: { patientId, tenantId }, include: { therapist: { include: { user: { select: { firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' } }),
    prisma.schemeClaim.findMany({ where: { patientId, tenantId }, include: { scheme: true }, orderBy: { createdAt: 'desc' } }),
    prisma.followUp.findMany({ where: { patientId, tenantId }, include: { therapist: { include: { user: { select: { firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' } }),
    prisma.reminderLog.findMany({ where: { patientId, tenantId }, orderBy: { sentAt: 'desc' } }),
    prisma.patientFeedback.findMany({ where: { patientId, tenantId }, orderBy: { createdAt: 'desc' } }),
    prisma.drugStockMovement.findMany({
      where: { patientId, tenantId, type: 'ISSUE' },
      include: { drugInventory: true, recordedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const therapistName = (therapist: any) => therapist?.user
    ? `${therapist.user.firstName} ${therapist.user.lastName}`
    : undefined;
  const timeline: any[] = [];
  const add = (type: string, date: Date, title: string, summary: string, data: any, actor?: string) => {
    timeline.push({ type, date, title, summary, actor, data });
  };

  appointments.forEach((appointment: any) => add(
    'appointment', appointment.startAt, 'Appointment',
    `${appointment.type} - ${appointment.status}`, appointment, therapistName(appointment.therapist),
  ));
  notes.forEach((note: any) => add(
    'soap_note', note.createdAt, 'SOAP note',
    note.assessment || note.complaint || 'Clinical note recorded', note, therapistName(note.appointment?.therapist),
  ));
  invoices.forEach((invoice: any) => add(
    'invoice', invoice.createdAt, 'Invoice',
    `${invoice.invoiceNumber} - ${invoice.status} - ${invoice.total}`, invoice,
  ));
  exercisePlans.forEach((plan: any) => add(
    'exercise_plan', plan.createdAt, 'Exercise plan',
    `${plan.name} (${plan.items?.length || 0} exercises)`, plan,
  ));
  treatmentPlans.forEach((plan: any) => add(
    'treatment_plan', plan.createdAt, 'Treatment plan',
    `${plan.name} - ${plan.status}`, plan,
  ));
  outcomeMeasures.forEach((measure: any) => add(
    'outcome_measure', measure.recordedAt, `${measure.type} outcome measure`,
    `${measure.score} / ${measure.maxScore} (${measure.percentage}%)`, measure,
  ));
  payments.forEach((payment: any) => add(
    'payment', payment.paidAt || payment.createdAt, 'Payment',
    `${payment.amount} via ${payment.methodName} - ${payment.status}`, payment,
  ));
  paymentRequests.forEach((paymentRequest: any) => add(
    'payment_request', paymentRequest.createdAt, 'Payment request',
    `${paymentRequest.provider} - ${paymentRequest.status} - ${paymentRequest.amount}`, paymentRequest,
  ));
  clientTasks.forEach((task: any) => add(
    'client_task', task.createdAt, 'Patient task',
    `${task.title} - ${task.status}`, task, therapistName(task.therapist),
  ));
  schemeClaims.forEach((claim: any) => add(
    'scheme_claim', claim.createdAt, 'Medical scheme claim',
    `${claim.scheme?.name || 'Medical scheme'} - ${claim.status} - ${claim.amount}`, claim,
  ));
  followUps.forEach((followUp: any) => add(
    'follow_up', followUp.createdAt, 'Follow-up',
    `${followUp.type} - ${followUp.status}`, followUp, therapistName(followUp.therapist),
  ));
  reminderLogs.forEach((reminder: any) => add(
    'reminder', reminder.sentAt, 'Reminder',
    `${reminder.channel} - ${reminder.status}`, reminder,
  ));
  feedback.forEach((item: any) => add(
    'feedback', item.createdAt, 'Patient feedback',
    `${item.rating}/5${item.comment ? ` - ${item.comment}` : ''}`, item,
  ));
  drugIssues.forEach((issue: any) => add(
    'drug_issue', issue.createdAt, 'Medication issued',
    `${issue.drugInventory?.name || 'Medication'} x${issue.quantity} ${issue.drugInventory?.unit || 'unit(s)'}`,
    issue, issue.recordedBy ? `${issue.recordedBy.firstName} ${issue.recordedBy.lastName}` : undefined,
  ));

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalInvoiced = invoices
    .filter((invoice: any) => invoice.status !== 'VOID')
    .reduce((sum: number, invoice: any) => sum + Number(invoice.total || 0), 0);
  const totalPaid = payments
    .filter((payment: any) => payment.status === 'COMPLETED')
    .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);

  return {
    summary: {
      appointments: appointments.length,
      completedAppointments: appointments.filter((item: any) => item.status === 'COMPLETED').length,
      soapNotes: notes.length,
      treatmentPlans: treatmentPlans.length,
      exercisePlans: exercisePlans.length,
      outcomeMeasures: outcomeMeasures.length,
      invoices: invoices.length,
      payments: payments.length,
      paymentRequests: paymentRequests.length,
      medicationIssues: drugIssues.length,
      tasks: clientTasks.length,
      totalInvoiced,
      totalPaid,
      outstandingBalance: Math.max(totalInvoiced - totalPaid, 0),
    },
    records: {
      appointments,
      soapNotes: notes,
      invoices,
      exercisePlans,
      treatmentPlans,
      outcomeMeasures,
      payments,
      paymentRequests,
      clientTasks,
      schemeClaims,
      followUps,
      reminderLogs,
      feedback,
      drugIssues,
    },
    timeline,
  };
}

export async function getTimeline(tenantId: string, patientId: string, userId?: string, userRole?: string) {
  const history = await getHistory(tenantId, patientId, userId, userRole);
  return history.timeline;
}
