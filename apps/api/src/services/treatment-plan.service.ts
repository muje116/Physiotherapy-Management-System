import { prisma } from '@physiocore/db';
import { NotFoundError, ValidationError } from '../utils/errors';

type NormalisedStage = {
  name: string;
  description: string | null;
  order: number;
  durationWeeks?: number;
};

function normaliseStages(stages: any[] | undefined) {
  if (!Array.isArray(stages)) return undefined;

  return stages
    .filter((stage) => stage?.name)
    .map((stage, index) => {
      const normalisedStage: NormalisedStage = {
        name: stage.name,
        description: stage.description || null,
        order: stage.order ?? index + 1,
      };

      if (stage.durationWeeks !== undefined && stage.durationWeeks !== null) {
        normalisedStage.durationWeeks = stage.durationWeeks;
      }

      return normalisedStage;
    });
}

export async function listPlans(tenantId: string, query: any) {
  const where: any = { tenantId };
  if (query.patientId) where.patientId = query.patientId;
  if (query.status) where.status = query.status;

  const items = await prisma.treatmentPlan.findMany({
    where,
    include: { patient: true, stages: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    skip: ((query.page || 1) - 1) * (query.limit || 20),
    take: query.limit || 20,
  });
  const total = await prisma.treatmentPlan.count({ where });
  return { items, total, page: query.page || 1, limit: query.limit || 20 };
}

export async function createPlan(tenantId: string, data: any) {
  const { stages, title, name, ...input } = data;
  const planName = name || title;
  if (!planName) throw new ValidationError('Treatment plan name is required');

  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, tenantId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError('Patient not found');

  const stageData = normaliseStages(stages);

  return prisma.treatmentPlan.create({
    data: {
      tenantId,
      patientId: input.patientId,
      name: planName,
      diagnosis: input.diagnosis,
      goals: input.goals,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      notes: input.notes,
      stages: stageData ? { create: stageData } : undefined,
    },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
}

export async function getPlan(tenantId: string, id: string) {
  return prisma.treatmentPlan.findUnique({
    where: { id, tenantId },
    include: {
      patient: true,
      stages: { orderBy: { order: 'asc' } },
      clientTasks: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function updatePlan(tenantId: string, id: string, data: any) {
  const plan = await prisma.treatmentPlan.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!plan) throw new NotFoundError('Treatment plan not found');

  const { stages, title, name, ...input } = data;
  const stageData = normaliseStages(stages);
  const planData: Record<string, unknown> = {};

  if (name !== undefined || title !== undefined) planData.name = name ?? title;
  if (input.diagnosis !== undefined) planData.diagnosis = input.diagnosis;
  if (input.goals !== undefined) planData.goals = input.goals;
  if (input.startDate !== undefined) planData.startDate = new Date(input.startDate);
  if (input.notes !== undefined) planData.notes = input.notes;

  return prisma.treatmentPlan.update({
    where: { id, tenantId },
    data: {
      ...planData,
      stages: stageData
        ? {
            deleteMany: {},
            create: stageData,
          }
        : undefined,
    },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
}

export async function addStage(tenantId: string, planId: string, data: any) {
  const plan = await prisma.treatmentPlan.findFirst({ where: { id: planId, tenantId }, select: { id: true } });
  if (!plan) throw new NotFoundError('Treatment plan not found');

  return prisma.treatmentPlanStage.create({
    data: {
      planId,
      name: data.name,
      description: data.description,
      durationWeeks: data.durationWeeks,
      order: data.order ?? 0,
    },
  });
}

export async function updateStage(tenantId: string, planId: string, stageId: string, data: any) {
  const plan = await prisma.treatmentPlan.findFirst({ where: { id: planId, tenantId }, select: { id: true } });
  if (!plan) throw new NotFoundError('Treatment plan not found');

  const stage = await prisma.treatmentPlanStage.findFirst({ where: { id: stageId, planId }, select: { id: true } });
  if (!stage) throw new NotFoundError('Treatment plan stage not found');

  const stageUpdate: any = {};

  if (data.name !== undefined) stageUpdate.name = data.name;
  if (data.description !== undefined) stageUpdate.description = data.description;
  if (data.durationWeeks !== undefined) stageUpdate.durationWeeks = data.durationWeeks;
  if (data.order !== undefined) stageUpdate.order = data.order;

  if (data.progress !== undefined) {
    if (data.progress >= 100) {
      stageUpdate.status = 'COMPLETED';
      stageUpdate.completedDate = new Date();
      stageUpdate.startDate = stageUpdate.startDate || new Date();
    } else if (data.progress > 0) {
      stageUpdate.status = 'IN_PROGRESS';
      stageUpdate.startDate = new Date();
      stageUpdate.completedDate = null;
    } else {
      stageUpdate.status = 'NOT_STARTED';
      stageUpdate.startDate = null;
      stageUpdate.completedDate = null;
    }
  }

  return prisma.treatmentPlanStage.update({
    where: { id: stageId, planId },
    data: stageUpdate,
  });
}

export async function completePlan(tenantId: string, id: string) {
  const plan = await prisma.treatmentPlan.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!plan) throw new NotFoundError('Treatment plan not found');

  return prisma.treatmentPlan.update({
    where: { id, tenantId },
    data: { status: 'COMPLETED', endDate: new Date() },
  });
}
