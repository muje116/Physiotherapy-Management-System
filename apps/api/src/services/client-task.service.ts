import { prisma } from '@physiocore/db';
import { NotFoundError, ValidationError } from '../utils/errors';
import { sendClientTaskNotification } from './notification.service';

export async function listTasks(tenantId: string, query: any) {
  const where: any = { tenantId };
  if (query.patientId) where.patientId = query.patientId;
  if (query.status) where.status = query.status;
  if (query.taskType) where.taskType = query.taskType;

  const items = await prisma.clientTask.findMany({
    where,
    include: { patient: true, therapist: { include: { user: true } }, treatmentPlan: true },
    orderBy: { createdAt: 'desc' },
    skip: ((query.page || 1) - 1) * (query.limit || 20),
    take: query.limit || 20,
  });
  const total = await prisma.clientTask.count({ where });
  return { items, total, page: query.page || 1, limit: query.limit || 20 };
}

export async function createTask(tenantId: string, userId: string, data: any) {
  const [patient, currentTherapist] = await Promise.all([
    prisma.patient.findFirst({ where: { id: data.patientId, tenantId }, select: { id: true } }),
    prisma.therapist.findFirst({ where: { userId, tenantId }, select: { id: true } }),
  ]);
  if (!patient) throw new NotFoundError('Patient not found');

  let therapistId = currentTherapist?.id || data.therapistId;
  if (!therapistId) throw new ValidationError('A therapist must be assigned to the task');
  if (!currentTherapist) {
    const assignedTherapist = await prisma.therapist.findFirst({
      where: { id: therapistId, tenantId },
      select: { id: true },
    });
    if (!assignedTherapist) throw new NotFoundError('Therapist not found');
    therapistId = assignedTherapist.id;
  }

  if (data.treatmentPlanId) {
    const treatmentPlan = await prisma.treatmentPlan.findFirst({
      where: { id: data.treatmentPlanId, tenantId, patientId: data.patientId },
      select: { id: true },
    });
    if (!treatmentPlan) throw new NotFoundError('Treatment plan not found for patient');
  }

  const task = await prisma.clientTask.create({
    data: {
      tenantId,
      patientId: data.patientId,
      therapistId,
      treatmentPlanId: data.treatmentPlanId || null,
      title: data.title,
      description: data.description || null,
      taskType: data.taskType || 'EXERCISE',
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: 'PENDING',
    },
  });

  if (data.autoSendEmail !== false) {
    await sendClientTaskNotification(task.id, tenantId);
  }

  return task;
}

export async function updateTask(tenantId: string, id: string, data: any) {
  const task = await prisma.clientTask.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!task) throw new NotFoundError('Client task not found');

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.taskType !== undefined) updateData.taskType = data.taskType;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  return prisma.clientTask.update({ where: { id }, data: updateData });
}

export async function completeTask(tenantId: string, id: string) {
  const task = await prisma.clientTask.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!task) throw new NotFoundError('Client task not found');
  return prisma.clientTask.update({
    where: { id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
}

export async function sendTaskEmail(tenantId: string, id: string) {
  const task = await prisma.clientTask.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!task) throw new NotFoundError('Client task not found');
  return sendClientTaskNotification(id, tenantId);
}

export async function getTaskStats(tenantId: string) {
  const total = await prisma.clientTask.count({ where: { tenantId } });
  const pending = await prisma.clientTask.count({ where: { tenantId, status: 'PENDING' } });
  const sent = await prisma.clientTask.count({ where: { tenantId, status: 'SENT' } });
  const completed = await prisma.clientTask.count({ where: { tenantId, status: 'COMPLETED' } });
  const overdue = await prisma.clientTask.count({
    where: { tenantId, dueDate: { lt: new Date() }, status: { in: ['PENDING', 'SENT'] } },
  });
  return { total, pending, sent, completed, overdue, completionRate: total ? Math.round((completed / total) * 100) : 0 };
}
