import { Job, Worker } from 'bullmq';
import { prisma } from '@physiocore/db';
import { redisConnection } from '../redis';
import { deliverNotification, DeliveryChannel } from '../delivery';

type ExercisePlanJobData = { planId: string; tenantId: string; patientId: string };
type MessageTemplate = { channel: string[]; subject?: string | null; body: string };

class DeliveryError extends Error {}

function renderMessage(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
}

async function findMessageTemplate(tenantId: string): Promise<MessageTemplate | null> {
  const template = await prisma.notificationTemplate.findFirst({
    where: { tenantId, trigger: 'EXERCISE_PLAN_SENT', isActive: true },
  });
  if (template) return template;

  const rule = await prisma.reminderRule.findFirst({
    where: { tenantId, trigger: 'EXERCISE_PLAN_SENT', isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  return rule ? { channel: rule.channel, body: rule.template } : null;
}

async function sendExercisePlan(job: Job<ExercisePlanJobData>) {
  const { planId, tenantId, patientId } = job.data;
  const plan = await prisma.exercisePlan.findFirst({
    where: { id: planId, tenantId, patientId },
    include: {
      patient: { select: { id: true, firstName: true, email: true, phone: true } },
      items: { orderBy: { order: 'asc' }, select: { id: true } },
    },
  });
  if (!plan) throw new DeliveryError('The exercise plan or patient could not be found.');
  if (plan.sendStatus === 'SENT') return;

  const template = await findMessageTemplate(tenantId);
  const vars = {
    patientName: plan.patient.firstName,
    planName: plan.name,
    exerciseCount: String(plan.items.length),
    link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal/exercise-plans`,
  };
  const body = template
    ? renderMessage(template.body, vars)
    : `Hello ${vars.patientName}, your exercise plan "${vars.planName}" is ready in the patient portal.`;
  const channels = template?.channel?.length ? template.channel : ['EMAIL'];
  let attempted = 0;
  let delivered = 0;

  for (const channel of channels) {
    if (channel !== 'EMAIL' && channel !== 'SMS' && channel !== 'WHATSAPP') continue;
    const to = channel === 'EMAIL' ? plan.patient.email : plan.patient.phone;
    if (!to) continue;

    attempted++;
    const succeeded = await deliverNotification({
      tenantId,
      channel: channel as DeliveryChannel,
      to,
      subject: renderMessage(template?.subject || `Exercise plan: ${plan.name}`, vars),
      body,
    });
    if (succeeded) delivered++;

    await prisma.reminderLog.create({
      data: {
        tenantId,
        patientId,
        channel,
        status: succeeded ? 'SENT' : 'FAILED',
        sentAt: new Date(),
      },
    });
  }

  if (attempted === 0) {
    throw new DeliveryError('No contact details are available for the configured delivery channels.');
  }
  if (delivered === 0) {
    throw new DeliveryError('Delivery failed. Check the patient contact details and notification channel settings, then try again.');
  }

  await prisma.exercisePlan.update({
    where: { id: planId },
    data: { sentAt: new Date(), sendStatus: 'SENT', sendError: null },
  });
}

const worker = new Worker<ExercisePlanJobData>('exercise-plans', async (job) => {
  try {
    await sendExercisePlan(job);
  } catch (error) {
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);
    if (finalAttempt) {
      const message = error instanceof DeliveryError
        ? error.message
        : 'Delivery failed. Check the patient contact details and notification channel settings, then try again.';
      await prisma.exercisePlan.updateMany({
        where: { id: job.data.planId, tenantId: job.data.tenantId, sendStatus: 'QUEUED' },
        data: { sendStatus: 'FAILED', sendError: message },
      });
    }
    throw error;
  }
}, { connection: redisConnection });

worker.on('failed', (job, error) => {
  console.error(`[exercise-plans] Job ${job?.name} failed:`, error);
});

export { worker };
