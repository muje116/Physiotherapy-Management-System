import { prisma } from '@physiocore/db';
import { sendEmail } from './integrations/email.service';
import { sendSms, sendWhatsApp } from './integrations/sms.service';
import { NotFoundError } from '../utils/errors';

type NotificationPayload = {
  to: string;
  subject?: string;
  body: string;
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP';
  tenantId: string;
  patientId: string;
  appointmentId?: string;
};

type MessageTemplate = {
  channel: string[];
  subject?: string | null;
  body: string;
};

type NotificationChannelConfig = {
  apiKey?: string | null;
  from?: string | null;
  config?: unknown;
};

function getTwilioOptions(channel: NotificationChannelConfig) {
  const config = channel.config && typeof channel.config === 'object' && !Array.isArray(channel.config)
    ? channel.config as Record<string, unknown>
    : {};

  return {
    accountSid: typeof config.accountSid === 'string' ? config.accountSid : undefined,
    authToken: channel.apiKey || undefined,
    from: channel.from || undefined,
  };
}

async function findMessageTemplate(tenantId: string, trigger: string, fallbackTrigger?: string): Promise<MessageTemplate | null> {
  const template = await prisma.notificationTemplate.findFirst({
    where: { tenantId, trigger, isActive: true },
  });
  if (template) return template;

  // Reminder rules are retained as a backwards-compatible source for installations
  // that configured rules before notification templates were introduced.
  const reminderRuleClient = (prisma as any).reminderRule;
  if (!reminderRuleClient?.findFirst) return null;

  const rule = await reminderRuleClient.findFirst({
    where: { tenantId, trigger, isActive: true },
    orderBy: { createdAt: 'desc' },
  }) || (fallbackTrigger ? await reminderRuleClient.findFirst({
    where: { tenantId, trigger: fallbackTrigger, isActive: true },
    orderBy: { createdAt: 'desc' },
  }) : null);

  return rule ? { channel: rule.channel, subject: null, body: rule.template } : null;
}

export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
  const channel = await prisma.notificationChannel.findFirst({
    where: { tenantId: payload.tenantId, type: mapChannelToType(payload.channel), isActive: true },
    select: { apiKey: true, from: true, config: true },
  });
  if (!channel) return false;

  try {
    let sent = false;

    switch (payload.channel) {
      case 'EMAIL':
        sent = await sendEmail({
          to: payload.to,
          subject: payload.subject || '',
          body: payload.body,
          from: channel.from || undefined,
        }, { apiKey: channel.apiKey || undefined });
        break;
      case 'SMS':
        sent = await sendSms({ to: payload.to, body: payload.body, from: channel.from || undefined }, getTwilioOptions(channel));
        break;
      case 'WHATSAPP':
        sent = await sendWhatsApp({ to: payload.to, body: payload.body, from: channel.from || undefined }, getTwilioOptions(channel));
        break;
    }

    await prisma.reminderLog.create({
      data: {
        tenantId: payload.tenantId,
        patientId: payload.patientId,
        appointmentId: payload.appointmentId || null,
        channel: payload.channel,
        status: sent ? 'SENT' : 'FAILED',
        sentAt: new Date(),
      },
    });
    return sent;
  } catch (error) {
    await prisma.reminderLog.create({
      data: {
        tenantId: payload.tenantId,
        patientId: payload.patientId,
        appointmentId: payload.appointmentId || null,
        channel: payload.channel,
        status: 'FAILED',
        sentAt: new Date(),
      },
    });
    return false;
  }
}

function mapChannelToType(channel: string): string {
  const map: Record<string, string> = {
    'SMS': 'TWILIO_SMS',
    'WHATSAPP': 'TWILIO_WHATSAPP',
    'EMAIL': 'RESEND_EMAIL',
  };
  return map[channel] || channel;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

export async function sendAppointmentReminder(appointmentId: string, trigger: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, therapist: { include: { user: true } } },
  });
  if (!appointment || !appointment.patient) return;

  const template = await findMessageTemplate(appointment.tenantId, trigger, 'APPOINTMENT_REMINDER');
  if (!template) return;

  const vars = {
    patientName: appointment.patient.firstName,
    therapistName: appointment.therapist?.user.firstName || 'therapist',
    date: appointment.startAt.toLocaleDateString(),
    time: appointment.startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal`,
  };

  for (const channel of template.channel) {
    const to = channel === 'EMAIL' ? appointment.patient.email : appointment.patient.phone;
    if (!to) continue;

    await sendNotification({
      to,
      subject: renderTemplate(template.subject || 'Appointment Reminder', vars),
      body: renderTemplate(template.body, vars),
      channel: channel as 'SMS' | 'EMAIL' | 'WHATSAPP',
      tenantId: appointment.tenantId,
      patientId: appointment.patientId,
      appointmentId: appointment.id,
    });
  }
}

export async function sendClientTaskNotification(taskId: string, tenantId?: string) {
  const task = tenantId
    ? await prisma.clientTask.findFirst({
      where: { id: taskId, tenantId },
      include: { patient: true, therapist: { include: { user: true } } },
    })
    : await prisma.clientTask.findUnique({
      where: { id: taskId },
      include: { patient: true, therapist: { include: { user: true } } },
    });
  if (!task || !task.patient?.email) return;

  const template = await findMessageTemplate(task.tenantId, 'TASK_ASSIGNED');

  const vars = {
    patientName: task.patient.firstName,
    therapistName: task.therapist?.user.firstName || 'therapist',
    taskTitle: task.title,
    taskDescription: task.description || '',
    dueDate: task.dueDate?.toLocaleDateString() || 'Not set',
    link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal/exercise-plans`,
  };

  const body = template
    ? renderTemplate(template.body, vars)
    : `Hello ${vars.patientName}, you have a new task: ${vars.taskTitle}. ${vars.taskDescription}. Due: ${vars.dueDate}.`;

  const sent = await sendNotification({
    to: task.patient.email,
    subject: `New Task: ${task.title}`,
    body,
    channel: 'EMAIL',
    tenantId: task.tenantId,
    patientId: task.patientId,
  });

  if (!sent) return false;

  await prisma.clientTask.update({
    where: { id: taskId },
    data: { emailSentAt: new Date(), status: 'SENT' },
  });
  return true;
}

export async function sendExercisePlanNotification(tenantId: string, planId: string) {
  const plan = await prisma.exercisePlan.findFirst({
    where: { id: planId, tenantId },
    include: { patient: true, items: { orderBy: { order: 'asc' } } },
  });
  if (!plan || !plan.patient) return false;

  const template = await findMessageTemplate(tenantId, 'EXERCISE_PLAN_SENT');
  const vars = {
    patientName: plan.patient.firstName,
    planName: plan.name,
    exerciseCount: String(plan.items.length),
    link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal/exercise-plans`,
  };
  const body = template
    ? renderTemplate(template.body, vars)
    : `Hello ${vars.patientName}, your exercise plan "${vars.planName}" is ready in the patient portal.`;
  const channels = template?.channel?.length ? template.channel : ['EMAIL'];
  let sent = false;

  for (const channel of channels) {
    const normalizedChannel = channel as 'EMAIL' | 'SMS' | 'WHATSAPP';
    const to = normalizedChannel === 'EMAIL' ? plan.patient.email : plan.patient.phone;
    if (!to || !['EMAIL', 'SMS', 'WHATSAPP'].includes(normalizedChannel)) continue;

    sent = (await sendNotification({
      to,
      subject: renderTemplate(template?.subject || `Exercise plan: ${plan.name}`, vars),
      body,
      channel: normalizedChannel,
      tenantId,
      patientId: plan.patientId,
    })) || sent;
  }

  if (sent) {
    await prisma.exercisePlan.update({ where: { id: planId }, data: { sentAt: new Date() } });
  }
  return sent;
}

export async function createNoShowFollowUp(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true },
  });
  if (!appointment) return;

  const existing = await prisma.followUp.findFirst({
    where: { appointmentId, type: 'NO_SHOW' },
  });
  if (existing) return;

  await prisma.followUp.create({
    data: {
      tenantId: appointment.tenantId,
      patientId: appointment.patientId,
      appointmentId: appointment.id,
      therapistId: appointment.therapistId,
      type: 'NO_SHOW',
      status: 'PENDING',
      followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const template = await findMessageTemplate(appointment.tenantId, 'NO_SHOW');

  const vars = {
    patientName: appointment.patient.firstName,
    date: appointment.startAt.toLocaleDateString(),
    time: appointment.startAt.toLocaleTimeString(),
    link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal`,
  };

  const body = template
    ? renderTemplate(template.body, vars)
    : `Hello ${vars.patientName}, we missed you at your appointment on ${vars.date}. Please contact us to reschedule.`;

  if (appointment.patient.phone) {
    await sendNotification({
      to: appointment.patient.phone,
      body,
      channel: 'SMS',
      tenantId: appointment.tenantId,
      patientId: appointment.patientId,
      appointmentId: appointment.id,
    });
  }
  if (appointment.patient.email) {
    await sendNotification({
      to: appointment.patient.email,
      subject: 'We missed you - Appointment Follow-up',
      body,
      channel: 'EMAIL',
      tenantId: appointment.tenantId,
      patientId: appointment.patientId,
      appointmentId: appointment.id,
    });
  }
}

export async function sendReengagementNotifications() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const inactivePatients = await prisma.patient.findMany({
    where: {
      isActive: true,
      appointments: {
        none: { startAt: { gt: sevenDaysAgo } },
      },
    },
    include: { tenant: true },
  });

  for (const patient of inactivePatients) {
    const template = await findMessageTemplate(patient.tenantId, 'REENGAGEMENT');

    const vars = { patientName: patient.firstName, link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal` };
    const body = template
      ? renderTemplate(template.body, vars)
      : `Hello ${vars.patientName}, it's been a while! We'd love to see you again. Book your next session today.`;

    if (patient.email) {
      await sendNotification({ to: patient.email, subject: 'We miss you!', body, channel: 'EMAIL', tenantId: patient.tenantId, patientId: patient.id });
    }
    if (patient.phone) {
      await sendNotification({ to: patient.phone, body, channel: 'SMS', tenantId: patient.tenantId, patientId: patient.id });
    }
  }
  return inactivePatients.length;
}

export async function listTemplates(tenantId: string) {
  return prisma.notificationTemplate.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
}

export async function createTemplate(tenantId: string, data: any) {
  return prisma.notificationTemplate.create({ data: { ...data, tenantId } });
}

export async function updateTemplate(tenantId: string, id: string, data: any) {
  return prisma.notificationTemplate.update({ where: { id, tenantId }, data });
}

export async function deleteTemplate(tenantId: string, id: string) {
  return prisma.notificationTemplate.delete({ where: { id, tenantId } });
}

export async function listChannels(tenantId: string) {
  const channels = await prisma.notificationChannel.findMany({
    where: { tenantId },
    select: { id: true, type: true, from: true, isActive: true, config: true, apiKey: true },
  });

  return channels.map(({ apiKey, ...channel }) => ({
    ...channel,
    hasApiKey: Boolean(apiKey),
  }));
}

export async function upsertChannel(tenantId: string, type: string, data: any) {
  const { id, ...channelData } = data;
  if (id) {
    const existing = await prisma.notificationChannel.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundError('Notification channel not found');
    return prisma.notificationChannel.update({ where: { id }, data: channelData });
  }

  return prisma.notificationChannel.create({ data: { ...channelData, tenantId, type } });
}

export async function updateChannel(tenantId: string, id: string, data: any) {
  return prisma.notificationChannel.update({
    where: { id, tenantId },
    data,
  });
}

export async function listFollowUps(tenantId: string, query: any) {
  const where: any = { tenantId };
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.patientId) where.patientId = query.patientId;

  const items = await prisma.followUp.findMany({
    where,
    include: { patient: true, therapist: { include: { user: true } } },
    orderBy: { createdAt: 'desc' },
    skip: ((query.page || 1) - 1) * (query.limit || 20),
    take: query.limit || 20,
  });
  const total = await prisma.followUp.count({ where });
  return { items, total, page: query.page || 1, limit: query.limit || 20 };
}

export async function updateFollowUp(tenantId: string, id: string, data: any) {
  const followUp = await prisma.followUp.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!followUp) throw new NotFoundError('Follow-up not found');

  const updateData = { ...data };
  if (data.status === 'CONTACTED' && data.contactedAt === undefined) {
    updateData.contactedAt = new Date();
  }

  return prisma.followUp.update({ where: { id }, data: updateData });
}

export async function getFollowUpStats(tenantId: string) {
  const total = await prisma.followUp.count({ where: { tenantId } });
  const pending = await prisma.followUp.count({ where: { tenantId, status: 'PENDING' } });
  const rescheduled = await prisma.followUp.count({ where: { tenantId, status: 'RESCHEDULED' } });
  const closed = await prisma.followUp.count({ where: { tenantId, status: 'CLOSED' } });
  const contacted = await prisma.followUp.count({ where: { tenantId, status: 'CONTACTED' } });
  return { total, pending, rescheduled, closed, contacted, reengagementRate: total ? Math.round((rescheduled / total) * 100) : 0 };
}
