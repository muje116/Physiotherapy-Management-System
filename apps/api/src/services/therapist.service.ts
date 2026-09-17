import { prisma, Role } from '@physiocore/db';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { PaginatedResult } from '../types';

export async function list(tenantId: string) {
  const therapists = await prisma.therapist.findMany({
    where: { tenantId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true } },
      _count: { select: { appointments: true, patients: true } },
    },
  });

  const totalAppointments = await prisma.appointment.count({
    where: { tenantId, therapistId: { in: therapists.map((t) => t.id) } },
  });

  return therapists.map((t) => ({
    ...t,
    utilisation: t._count.appointments > 0 && totalAppointments > 0
      ? Math.round((t._count.appointments / totalAppointments) * 100)
      : 0,
  }));
}

export async function create(tenantId: string, data: { userId: string; registrationNo?: string; specialties?: string[]; bio?: string; avatarUrl?: string }) {
  const user = await prisma.user.findFirst({ where: { id: data.userId, tenantId } });
  if (!user) throw new NotFoundError('User not found in this tenant');

  const existingTherapist = await prisma.therapist.findUnique({ where: { userId: data.userId } });
  if (existingTherapist) throw new ConflictError('User already has a therapist profile');

  const therapist = await prisma.therapist.create({
    data: {
      tenantId,
      userId: data.userId,
      registrationNo: data.registrationNo,
      specialties: data.specialties || [],
      bio: data.bio,
      avatarUrl: data.avatarUrl,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  });

  return therapist;
}

export async function getById(tenantId: string, therapistId: string) {
  const therapist = await prisma.therapist.findFirst({
    where: { id: therapistId, tenantId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true } },
      scheduleBlocks: { orderBy: { startAt: 'asc' } },
      _count: { select: { patients: true, appointments: true } },
    },
  });

  if (!therapist) throw new NotFoundError('Therapist not found');
  return therapist;
}

export async function update(tenantId: string, therapistId: string, data: any) {
  const therapist = await prisma.therapist.findFirst({ where: { id: therapistId, tenantId } });
  if (!therapist) throw new NotFoundError('Therapist not found');

  const updateData: any = {};
  if (data.registrationNo !== undefined) updateData.registrationNo = data.registrationNo;
  if (data.specialties !== undefined) updateData.specialties = data.specialties;
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.therapist.update({
    where: { id: therapistId },
    data: updateData,
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export async function getSchedule(tenantId: string, therapistId: string, startDate: string, endDate: string) {
  const therapist = await prisma.therapist.findFirst({
    where: { id: therapistId, tenantId },
    select: { id: true },
  });
  if (!therapist) throw new NotFoundError('Therapist not found');

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end <= start) throw new ValidationError('Schedule end date must be after the start date');

  return prisma.scheduleBlock.findMany({
    where: {
      tenantId,
      therapistId,
      startAt: { gte: start },
      endAt: { lte: end },
    },
    orderBy: { startAt: 'asc' },
  });
}

export async function addScheduleBlock(tenantId: string, therapistId: string, data: { startAt: string; endAt: string; type?: string; label?: string }) {
  const therapist = await prisma.therapist.findFirst({ where: { id: therapistId, tenantId } });
  if (!therapist) throw new NotFoundError('Therapist not found');

  const startAt = new Date(data.startAt);
  const endAt = new Date(data.endAt);
  if (endAt <= startAt) throw new ValidationError('Schedule block end time must be after the start time');

  return prisma.scheduleBlock.create({
    data: {
      tenantId,
      therapistId,
      startAt,
      endAt,
      type: data.type || 'AVAILABLE',
      label: data.label,
    },
  });
}

export async function removeScheduleBlock(tenantId: string, therapistId: string, blockId: string) {
  const block = await prisma.scheduleBlock.findFirst({
    where: { id: blockId, therapistId, tenantId },
  });
  if (!block) throw new NotFoundError('Schedule block not found');

  await prisma.scheduleBlock.delete({ where: { id: blockId } });
}

export async function getPatients(tenantId: string, therapistId: string) {
  const therapist = await prisma.therapist.findFirst({
    where: { id: therapistId, tenantId },
    select: { id: true },
  });
  if (!therapist) throw new NotFoundError('Therapist not found');

  return prisma.patient.findMany({
    where: {
      tenantId,
      therapists: { some: { therapistId } },
      isActive: true,
    },
    include: {
      _count: { select: { appointments: true, invoices: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getUtilisation(tenantId: string, therapistId: string, startDate: string, endDate: string) {
  const therapist = await prisma.therapist.findFirst({
    where: { id: therapistId, tenantId },
    select: { id: true },
  });
  if (!therapist) throw new NotFoundError('Therapist not found');

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const workStart = settings?.workingHoursStart || '08:00';
  const workEnd = settings?.workingHoursEnd || '17:00';
  const [wsH, wsM] = workStart.split(':').map(Number);
  const [weH, weM] = workEnd.split(':').map(Number);

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) throw new ValidationError('Utilisation end date must not be before the start date');
  const dayDurationMs = ((weH * 60 + weM) - (wsH * 60 + wsM)) * 60 * 1000;

  let totalAvailableMs = 0;
  let current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if ((settings?.workingDays || [1, 2, 3, 4, 5]).includes(day)) {
      totalAvailableMs += dayDurationMs;
    }
    current.setDate(current.getDate() + 1);
  }

  const bookedAppointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      therapistId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] as any },
      startAt: { gte: start },
      endAt: { lte: end },
    },
  });

  const bookedMs = bookedAppointments.reduce((sum, a) => sum + (a.endAt.getTime() - a.startAt.getTime()), 0);

  const utilisation = totalAvailableMs > 0 ? Math.round((bookedMs / totalAvailableMs) * 100) : 0;

  return {
    totalAvailableMinutes: Math.round(totalAvailableMs / 60000),
    bookedMinutes: Math.round(bookedMs / 60000),
    utilisation,
  };
}
