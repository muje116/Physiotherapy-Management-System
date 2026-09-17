import { prisma } from '@physiocore/db';
import { NotFoundError, ValidationError } from '../utils/errors';
import { PaginatedResult } from '../types';
import { sendExercisePlanNotification } from './notification.service';

export async function list(tenantId: string, query: { page: number; limit: number }): Promise<PaginatedResult<any>> {
  const where = { tenantId };

  const [items, total] = await Promise.all([
    prisma.exercisePlan.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        items: { orderBy: { order: 'asc' } },
      },
    }),
    prisma.exercisePlan.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function create(tenantId: string, data: { patientId: string; name: string; items?: Array<{ exerciseName: string; bodyRegion?: string; sets?: number; reps?: number; durationSecs?: number; frequency?: string; notes?: string; order?: number }> }) {
  const patient = await prisma.patient.findFirst({
    where: { id: data.patientId, tenantId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError('Patient not found');

  const plan = await prisma.exercisePlan.create({
    data: {
      tenantId,
      patientId: data.patientId,
      name: data.name,
      items: {
        create: (data.items || []).map((item, idx) => ({
          exerciseName: item.exerciseName,
          bodyRegion: item.bodyRegion,
          sets: item.sets,
          reps: item.reps,
          durationSecs: item.durationSecs,
          frequency: item.frequency,
          notes: item.notes,
          order: item.order ?? idx,
        })),
      },
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
      items: { orderBy: { order: 'asc' } },
    },
  });

  return plan;
}

export async function getById(tenantId: string, planId: string) {
  const plan = await prisma.exercisePlan.findFirst({
    where: { id: planId, tenantId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
      items: { orderBy: { order: 'asc' } },
    },
  });

  if (!plan) throw new NotFoundError('Exercise plan not found');
  return plan;
}

export async function update(tenantId: string, planId: string, data: { name?: string; isActive?: boolean }) {
  const plan = await prisma.exercisePlan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) throw new NotFoundError('Exercise plan not found');

  return prisma.exercisePlan.update({
    where: { id: planId },
    data,
    include: { items: { orderBy: { order: 'asc' } } },
  });
}

export async function send(tenantId: string, planId: string) {
  const plan = await prisma.exercisePlan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) throw new NotFoundError('Exercise plan not found');

  const sent = await sendExercisePlanNotification(tenantId, planId);
  if (!sent) throw new ValidationError('Exercise plan could not be sent; check the patient contact details and notification channel');

  return prisma.exercisePlan.findFirst({ where: { id: planId, tenantId } });
}

export async function addItem(tenantId: string, planId: string, data: { exerciseName: string; bodyRegion?: string; sets?: number; reps?: number; durationSecs?: number; frequency?: string; notes?: string; order?: number }) {
  const plan = await prisma.exercisePlan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) throw new NotFoundError('Exercise plan not found');

  const maxOrder = await prisma.exercisePlanItem.findFirst({
    where: { planId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  return prisma.exercisePlanItem.create({
    data: {
      planId,
      exerciseName: data.exerciseName,
      bodyRegion: data.bodyRegion,
      sets: data.sets,
      reps: data.reps,
      durationSecs: data.durationSecs,
      frequency: data.frequency,
      notes: data.notes,
      order: data.order ?? (maxOrder?.order ?? -1) + 1,
    },
  });
}

export async function updateItem(tenantId: string, planId: string, itemId: string, data: any) {
  const plan = await prisma.exercisePlan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) throw new NotFoundError('Exercise plan not found');

  const item = await prisma.exercisePlanItem.findFirst({ where: { id: itemId, planId } });
  if (!item) throw new NotFoundError('Exercise plan item not found');

  return prisma.exercisePlanItem.update({
    where: { id: itemId },
    data,
  });
}

export async function removeItem(tenantId: string, planId: string, itemId: string) {
  const plan = await prisma.exercisePlan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) throw new NotFoundError('Exercise plan not found');

  const item = await prisma.exercisePlanItem.findFirst({ where: { id: itemId, planId } });
  if (!item) throw new NotFoundError('Exercise plan item not found');

  await prisma.exercisePlanItem.delete({ where: { id: itemId } });
}
