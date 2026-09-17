import { prisma, AppointmentStatus, AppointmentType } from '@physiocore/db';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { PaginatedResult } from '../types';

interface AppointmentQuery {
  page: number;
  limit: number;
  startDate?: string;
  endDate?: string;
  therapistId?: string;
  status?: string;
}

export async function list(tenantId: string, query: AppointmentQuery): Promise<PaginatedResult<any>> {
  const where: any = { tenantId };

  if (query.therapistId) where.therapistId = query.therapistId;
  if (query.status) where.status = query.status as AppointmentStatus;

  if (query.startDate || query.endDate) {
    where.startAt = {};
    if (query.startDate) where.startAt.gte = new Date(query.startDate);
    if (query.endDate) where.startAt.lte = new Date(query.endDate);
  }

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { startAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        therapist: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    }),
    prisma.appointment.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function create(tenantId: string, data: {
  patientId: string;
  therapistId: string;
  startAt: string;
  endAt: string;
  type: string;
  isTelehealth?: boolean;
  notes?: string;
}) {
  const startAt = new Date(data.startAt);
  const endAt = new Date(data.endAt);
  if (endAt <= startAt) throw new ValidationError('Appointment end time must be after the start time');

  const [patient, therapist] = await Promise.all([
    prisma.patient.findFirst({ where: { id: data.patientId, tenantId }, select: { id: true } }),
    prisma.therapist.findFirst({ where: { id: data.therapistId, tenantId }, select: { id: true } }),
  ]);
  if (!patient) throw new NotFoundError('Patient not found');
  if (!therapist) throw new NotFoundError('Therapist not found');

  const overlapping = await prisma.appointment.findFirst({
    where: {
      tenantId,
      therapistId: data.therapistId,
      status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      AND: [
        { startAt: { lt: endAt } },
        { endAt: { gt: startAt } },
      ],
    },
  });

  if (overlapping) throw new ConflictError('Therapist has an overlapping appointment');

  const appointment = await prisma.appointment.create({
    data: {
      tenantId,
      patientId: data.patientId,
      therapistId: data.therapistId,
      startAt,
      endAt,
      type: data.type as AppointmentType,
      isTelehealth: data.isTelehealth || false,
      notes: data.notes,
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
      therapist: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  return appointment;
}

export async function getById(tenantId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true, email: true } },
      therapist: { include: { user: { select: { firstName: true, lastName: true } } } },
      soapNote: true,
      invoice: true,
    },
  });

  if (!appointment) throw new NotFoundError('Appointment not found');
  return appointment;
}

export async function update(tenantId: string, appointmentId: string, data: any) {
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, tenantId } });
  if (!appointment) throw new NotFoundError('Appointment not found');

  const startAt = data.startAt !== undefined ? new Date(data.startAt) : appointment.startAt;
  const endAt = data.endAt !== undefined ? new Date(data.endAt) : appointment.endAt;
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    throw new ValidationError('Appointment end time must be after the start time');
  }

  const finalStatus = data.status ?? appointment.status;
  if ((data.startAt !== undefined || data.endAt !== undefined)
    && finalStatus !== AppointmentStatus.CANCELLED
    && finalStatus !== AppointmentStatus.NO_SHOW) {
    const overlapping = await prisma.appointment.findFirst({
      where: {
        tenantId,
        therapistId: appointment.therapistId,
        id: { not: appointmentId },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        AND: [
          { startAt: { lt: endAt } },
          { endAt: { gt: startAt } },
        ],
      },
    });
    if (overlapping) throw new ConflictError('Therapist has an overlapping appointment');
  }

  const updateData: any = {};
  if (data.startAt !== undefined) updateData.startAt = startAt;
  if (data.endAt !== undefined) updateData.endAt = endAt;
  if (data.type !== undefined) updateData.type = data.type as AppointmentType;
  if (data.status !== undefined) updateData.status = data.status as AppointmentStatus;
  if (data.notes !== undefined) updateData.notes = data.notes;

  if (data.status === AppointmentStatus.CANCELLED) {
    updateData.cancelledAt = new Date();
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: updateData,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
      therapist: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  return updated;
}

export async function cancel(tenantId: string, appointmentId: string, reason?: string) {
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, tenantId } });
  if (!appointment) throw new NotFoundError('Appointment not found');

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledReason: reason,
    },
  });
}

export async function confirm(tenantId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, tenantId } });
  if (!appointment) throw new NotFoundError('Appointment not found');

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: AppointmentStatus.CONFIRMED },
  });
}

export async function markNoShow(tenantId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, tenantId } });
  if (!appointment) throw new NotFoundError('Appointment not found');

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: AppointmentStatus.NO_SHOW },
  });
}

export async function getAvailableSlots(tenantId: string, therapistId: string, date: string) {
  const targetDate = new Date(date);
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const therapist = await prisma.therapist.findFirst({
    where: { id: therapistId, tenantId },
  });
  if (!therapist) throw new NotFoundError('Therapist not found');

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });

  const workStart = settings?.workingHoursStart || '08:00';
  const workEnd = settings?.workingHoursEnd || '17:00';
  const duration = settings?.appointmentDuration || 45;

  const [workStartH, workStartM] = workStart.split(':').map(Number);
  const [workEndH, workEndM] = workEnd.split(':').map(Number);

  const scheduleBlocks = await prisma.scheduleBlock.findMany({
    where: {
      tenantId,
      therapistId,
      // Include blocks that cross either boundary of the requested day.
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
  });

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      therapistId,
      status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
  });

  const slots: { start: Date; end: Date }[] = [];
  let current = new Date(dayStart);
  current.setHours(workStartH, workStartM, 0, 0);
  const endOfWork = new Date(dayStart);
  endOfWork.setHours(workEndH, workEndM, 0, 0);

  while (current < endOfWork) {
    const slotEnd = new Date(current.getTime() + duration * 60 * 1000);
    if (slotEnd > endOfWork) break;

    const isBlocked = scheduleBlocks.some(
      (b) => current < b.endAt && slotEnd > b.startAt && b.type !== 'AVAILABLE'
    );

    const isBooked = existingAppointments.some(
      (a) => current < a.endAt && slotEnd > a.startAt
    );

    const availableBlock = scheduleBlocks.find(
      (b) => current >= b.startAt && slotEnd <= b.endAt && b.type === 'AVAILABLE'
    );

    if (!isBlocked && !isBooked) {
      slots.push({ start: new Date(current), end: new Date(slotEnd) });
    } else if (availableBlock) {
      slots.push({ start: new Date(current), end: new Date(slotEnd) });
    }

    current = slotEnd;
  }

  return slots;
}
