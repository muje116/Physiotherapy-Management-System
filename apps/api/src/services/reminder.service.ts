import { prisma } from '@physiocore/db';
import { NotFoundError, ValidationError } from '../utils/errors';
import { PaginatedResult } from '../types';
import { sendNotification } from './notification.service';

export async function listRules(tenantId: string) {
  return prisma.reminderRule.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createRule(tenantId: string, data: { trigger: string; channel: string[]; template: string; isActive?: boolean }) {
  return prisma.reminderRule.create({
    data: {
      tenantId,
      trigger: data.trigger,
      channel: data.channel,
      template: data.template,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateRule(tenantId: string, ruleId: string, data: { trigger?: string; channel?: string[]; template?: string; isActive?: boolean }) {
  const rule = await prisma.reminderRule.findFirst({ where: { id: ruleId, tenantId } });
  if (!rule) throw new NotFoundError('Reminder rule not found');

  return prisma.reminderRule.update({
    where: { id: ruleId },
    data,
  });
}

export async function deleteRule(tenantId: string, ruleId: string) {
  const rule = await prisma.reminderRule.findFirst({ where: { id: ruleId, tenantId } });
  if (!rule) throw new NotFoundError('Reminder rule not found');

  await prisma.reminderRule.delete({ where: { id: ruleId } });
}

export async function manualSend(tenantId: string, data: { recipientFilter: string; channel: string; message: string }) {
  const filter = data.recipientFilter.trim();
  const normalizedFilter = filter.toUpperCase();
  const where: { tenantId: string; isActive?: boolean; id?: string } = { tenantId };

  if (normalizedFilter === 'ACTIVE' || normalizedFilter === 'ALL') {
    where.isActive = normalizedFilter === 'ACTIVE' ? true : undefined;
  } else if (normalizedFilter === 'INACTIVE') {
    where.isActive = false;
  } else {
    where.id = filter;
  }

  const patients = await prisma.patient.findMany({
    where,
    select: { id: true, firstName: true, email: true, phone: true },
  });
  if (patients.length === 0) throw new NotFoundError('No patients match the recipient filter');

  const channel = data.channel as 'SMS' | 'EMAIL' | 'WHATSAPP';
  let attempted = 0;
  let delivered = 0;

  for (const patient of patients) {
    const to = channel === 'EMAIL' ? patient.email : patient.phone;
    if (!to) continue;
    attempted++;
    if (await sendNotification({
      to,
      body: data.message,
      subject: 'Message from your physiotherapy clinic',
      channel,
      tenantId,
      patientId: patient.id,
    })) delivered++;
  }

  if (attempted === 0) throw new ValidationError('No matching patients have a contact method for this channel');

  return {
    success: delivered > 0,
    message: delivered > 0 ? 'Message sent' : 'Message delivery failed',
    attempted,
    delivered,
    failed: attempted - delivered,
  };
}

export async function getLogs(tenantId: string, query: { page: number; limit: number; status?: string }): Promise<PaginatedResult<any>> {
  const where: any = { tenantId };
  if (query.status) where.status = query.status;

  const [items, total] = await Promise.all([
    prisma.reminderLog.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { sentAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.reminderLog.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function getStats(tenantId: string) {
  const logs = await prisma.reminderLog.findMany({ where: { tenantId } });

  const total = logs.length;
  const delivered = logs.filter((l) => l.status === 'SENT' || l.status === 'DELIVERED').length;
  const failed = logs.filter((l) => l.status === 'FAILED').length;
  const sent = delivered;

  return {
    total,
    delivered,
    failed,
    sent,
    deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
    failureRate: total > 0 ? Math.round((failed / total) * 100) : 0,
  };
}
