import { prisma, AppointmentStatus } from '@physiocore/db';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { recordPayment } from './payment.service';

export async function getProfile(userId: string) {
  const patient = await prisma.patient.findUnique({
    where: { portalUserId: userId },
    include: {
      _count: { select: { appointments: true, invoices: true, exercisePlans: true, soapNotes: true } },
    },
  });

  if (!patient) throw new NotFoundError('Patient profile not found');
  return patient;
}

export async function getAppointments(patientId: string) {
  return prisma.appointment.findMany({
    where: {
      patientId,
      startAt: { gte: new Date() },
      status: { notIn: [AppointmentStatus.CANCELLED] },
    },
    include: {
      therapist: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { startAt: 'asc' },
  });
}

export async function cancelAppointment(patientId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patientId },
  });

  if (!appointment) throw new NotFoundError('Appointment not found');

  if (appointment.startAt < new Date()) {
    throw new ForbiddenError('Cannot cancel past appointments');
  }

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledReason: 'Cancelled by patient',
    },
  });
}

export async function getInvoices(patientId: string) {
  return prisma.invoice.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getExercisePlans(patientId: string) {
  return prisma.exercisePlan.findMany({
    where: { patientId, isActive: true },
    include: { items: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSoapNotes(patientId: string) {
  return prisma.soapNote.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function payInvoice(patientId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, patientId },
  });

  if (!invoice) throw new NotFoundError('Invoice not found');
  if (invoice.status === 'PAID' || invoice.status === 'MEDICAL_AID_APPROVED') {
    throw new ForbiddenError('Invoice is already paid');
  }

  const totalPaid = await prisma.payment.aggregate({
    where: { tenantId: invoice.tenantId, invoiceId, patientId, status: 'COMPLETED' },
    _sum: { amount: true },
  });
  const outstanding = Math.max(Number(invoice.total) - Number(totalPaid._sum.amount || 0), 0);

  if (outstanding <= 0) throw new ForbiddenError('Invoice is already paid');

  await recordPayment(invoice.tenantId, {
    patientId,
    invoiceId,
    amount: outstanding,
    methodName: 'PORTAL',
  });

  return prisma.invoice.findFirst({ where: { id: invoiceId, patientId } });
}

export async function submitFeedback(tenantId: string, patientId: string, data: { rating: number; comment?: string }) {
  return prisma.patientFeedback.create({
    data: {
      tenantId,
      patientId,
      rating: data.rating,
      comment: data.comment || null,
    },
  });
}
