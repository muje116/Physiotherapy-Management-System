import { prisma } from '@physiocore/db';
import { NotFoundError, ValidationError } from '../utils/errors';

type OutcomeMeasureInput = {
  type: string;
  score: number;
  maxScore: number;
  notes?: string;
  recordedAt?: Date;
};

function calculatePercentage(score: number, maxScore: number) {
  if (maxScore <= 0) throw new ValidationError('Maximum score must be greater than zero');
  if (score < 0 || score > maxScore) throw new ValidationError('Score must be between zero and the maximum score');
  return Math.round((score / maxScore) * 10000) / 100;
}

export async function create(tenantId: string, patientId: string, data: OutcomeMeasureInput) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId }, select: { id: true } });
  if (!patient) throw new NotFoundError('Patient not found');

  return prisma.outcomeMeasure.create({
    data: {
      tenantId,
      patientId,
      type: data.type,
      score: data.score,
      maxScore: data.maxScore,
      percentage: calculatePercentage(data.score, data.maxScore),
      notes: data.notes || null,
      recordedAt: data.recordedAt,
    },
  });
}

export async function update(tenantId: string, id: string, data: Partial<OutcomeMeasureInput>) {
  const existing = await prisma.outcomeMeasure.findFirst({ where: { id, tenantId } });
  if (!existing) throw new NotFoundError('Outcome measure not found');

  const score = data.score ?? existing.score;
  const maxScore = data.maxScore ?? existing.maxScore;
  const updateData: Record<string, unknown> = {
    percentage: calculatePercentage(score, maxScore),
  };

  if (data.type !== undefined) updateData.type = data.type;
  if (data.score !== undefined) updateData.score = data.score;
  if (data.maxScore !== undefined) updateData.maxScore = data.maxScore;
  if (data.notes !== undefined) updateData.notes = data.notes || null;
  if (data.recordedAt !== undefined) updateData.recordedAt = data.recordedAt;

  return prisma.outcomeMeasure.update({ where: { id }, data: updateData });
}

export async function remove(tenantId: string, id: string) {
  const existing = await prisma.outcomeMeasure.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!existing) throw new NotFoundError('Outcome measure not found');
  await prisma.outcomeMeasure.delete({ where: { id } });
}
