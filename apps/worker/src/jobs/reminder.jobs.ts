import { Job, Worker } from 'bullmq';
import { prisma } from '@physiocore/db';
import { redisConnection } from '../redis';
import { deliverNotification, DeliveryChannel } from '../delivery';

const worker = new Worker('reminders', async (job: Job) => {
  switch (job.name) {
    case 'send-appointment-reminder':
      await handleAppointmentReminder();
      break;
    case 'send-no-show-notification':
      await handleNoShowNotification(job.data);
      break;
    case 'reengagement':
      await handleReengagement();
      break;
    default:
      throw new Error(`Unknown reminder job: ${job.name}`);
  }
}, {
  connection: redisConnection,
});

worker.on('failed', (job, err) => {
  console.error(`[reminders] Job ${job?.name} failed:`, err);
});

export { worker };

type MessageTemplate = {
  channel: string[];
  subject?: string | null;
  body: string;
};

async function findMessageTemplate(tenantId: string, trigger: string, fallbackTrigger?: string): Promise<MessageTemplate | null> {
  const template = await prisma.notificationTemplate.findFirst({
    where: { tenantId, trigger, isActive: true },
  });
  if (template) return template;

  const rule = await prisma.reminderRule.findFirst({
    where: { tenantId, trigger, isActive: true },
    orderBy: { createdAt: 'desc' },
  }) || (fallbackTrigger ? await prisma.reminderRule.findFirst({
    where: { tenantId, trigger: fallbackTrigger, isActive: true },
    orderBy: { createdAt: 'desc' },
  }) : null);

  return rule ? { channel: rule.channel, subject: null, body: rule.template } : null;
}

function renderMessage(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
}

async function handleAppointmentReminder() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      reminderSentAt: null,
      OR: [
        { startAt: { gte: in24h, lt: new Date(in24h.getTime() + 15 * 60 * 1000) } },
        { startAt: { gte: in2h, lt: new Date(in2h.getTime() + 15 * 60 * 1000) } },
      ],
    },
    include: { patient: true },
  });

  for (const apt of appointments) {
    const trigger = apt.startAt >= in24h ? 'APPOINTMENT_REMINDER_24H' : 'APPOINTMENT_REMINDER_2H';
    const template = await findMessageTemplate(apt.tenantId, trigger, 'APPOINTMENT_REMINDER');
    if (!template) continue;

    const vars = {
      patientName: apt.patient.firstName,
      date: apt.startAt.toLocaleDateString(),
      time: apt.startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal`,
    };

    let attempted = 0;
    let deliveredCount = 0;
    for (const channel of template.channel) {
      if (channel !== 'EMAIL' && channel !== 'SMS' && channel !== 'WHATSAPP') continue;
      const to = channel === 'EMAIL' ? apt.patient.email : apt.patient.phone;
      if (!to) continue;

      const body = renderMessage(template.body, vars);
      attempted++;
      const delivered = await deliverNotification({
        tenantId: apt.tenantId,
        channel: channel as DeliveryChannel,
        to,
        subject: template.subject ? renderMessage(template.subject, vars) : undefined,
        body,
      });
      if (delivered) deliveredCount++;

      await prisma.reminderLog.create({
        data: {
          tenantId: apt.tenantId,
          patientId: apt.patientId,
          appointmentId: apt.id,
          channel,
          status: delivered ? 'SENT' : 'FAILED',
          sentAt: new Date(),
        },
      });
      console.log(`[REMINDER] ${channel} reminder ${delivered ? 'sent' : 'failed'} for appointment ${apt.id}`);
    }

    if (attempted > 0 && deliveredCount > 0) {
      await prisma.appointment.update({ where: { id: apt.id }, data: { reminderSentAt: new Date() } });
    }
  }
}

async function handleNoShowNotification(data: { appointmentId: string }) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: data.appointmentId },
    include: { patient: true },
  });
  if (!appointment) return;

  await prisma.followUp.upsert({
    where: { id: `no-show-${data.appointmentId}` },
    update: {},
    create: {
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

  const vars = { patientName: appointment.patient.firstName };
  const msg = template
    ? renderMessage(template.body, vars)
    : `We missed you at your appointment. Please reschedule.`;

  const channels = template?.channel?.length ? template.channel : ['SMS', 'EMAIL'];
  for (const channel of channels) {
    if (channel !== 'SMS' && channel !== 'EMAIL' && channel !== 'WHATSAPP') continue;
    const to = channel === 'EMAIL' ? appointment.patient.email : appointment.patient.phone;
    if (!to) continue;

    const delivered = await deliverNotification({
      tenantId: appointment.tenantId,
      channel,
      to,
      subject: template?.subject ? renderMessage(template.subject, vars) : (channel === 'EMAIL' ? 'We missed you - Appointment Follow-up' : 'Appointment follow-up'),
      body: msg,
    });
    await prisma.reminderLog.create({
      data: { tenantId: appointment.tenantId, patientId: appointment.patientId, appointmentId: appointment.id, channel, status: delivered ? 'SENT' : 'FAILED', sentAt: new Date() },
    });
  }
  console.log(`[NO-SHOW] Follow-up created for appointment ${data.appointmentId}`);
}

async function handleReengagement() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const inactivePatients = await prisma.patient.findMany({
    where: {
      isActive: true,
      appointments: { none: { startAt: { gt: sevenDaysAgo } } },
    },
  });

  let count = 0;
  for (const patient of inactivePatients) {
    const template = await findMessageTemplate(patient.tenantId, 'REENGAGEMENT');
    if (!template) continue;

    const msg = renderMessage(template.body, { patientName: patient.firstName });
    const channels = template.channel?.length ? template.channel : ['EMAIL'];
    for (const channel of channels) {
      if (channel !== 'SMS' && channel !== 'EMAIL' && channel !== 'WHATSAPP') continue;
      const to = channel === 'EMAIL' ? patient.email : patient.phone;
      if (!to) continue;

      const delivered = await deliverNotification({
        tenantId: patient.tenantId,
        channel,
        to,
        subject: template.subject ? renderMessage(template.subject, { patientName: patient.firstName }) : 'We miss you!',
        body: msg,
      });
      await prisma.reminderLog.create({
        data: { tenantId: patient.tenantId, patientId: patient.id, channel, status: delivered ? 'SENT' : 'FAILED', sentAt: new Date() },
      });
    }

    await prisma.followUp.upsert({
      where: { id: `reengage-${patient.id}` },
      update: {},
      create: {
        tenantId: patient.tenantId,
        patientId: patient.id,
        type: 'REENGAGEMENT',
        status: 'PENDING',
        followUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
    count++;
  }
  console.log(`[REENGAGEMENT] Sent to ${count} inactive patients`);
}
