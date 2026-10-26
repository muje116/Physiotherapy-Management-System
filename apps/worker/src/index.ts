import net from 'node:net';
import { prisma } from '@physiocore/db';
import { redisConnection } from './redis';

async function isRedisAvailable() {
  const { host, port } = redisConnection;

  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (available: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(available);
    };

    socket.setTimeout(1500);
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.once('timeout', () => done(false));
  });
}

async function main() {
  console.log('Worker process started');

  if (!(await isRedisAvailable())) {
    const { host, port } = redisConnection;
    console.warn(`Redis is not available at ${host}:${port}. Background workers are disabled for this dev session.`);
    console.warn('Start Redis and restart the worker to enable reminders, invoices, reports, and medical-aid jobs.');
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Redis is required for the production worker');
    }
    return;
  }

  await import('./jobs/reminder.jobs');
  await import('./jobs/invoice.jobs');
  await import('./jobs/report.jobs');
  await import('./jobs/medical-aid.jobs');
  await import('./jobs/payment-request.jobs');
  const { reminderQueue, invoiceQueue, medicalAidQueue, paymentRequestQueue } = await import('./queues');

  // Register repeatable jobs
  await reminderQueue.upsertJobScheduler('send-appointment-reminder', { every: 15 * 60 * 1000 }, { name: 'send-appointment-reminder' });
  await reminderQueue.upsertJobScheduler('reengagement', { every: 24 * 60 * 60 * 1000 }, { name: 'reengagement' });
  await invoiceQueue.upsertJobScheduler('flag-overdue-invoices', { every: 24 * 60 * 60 * 1000 }, { name: 'flag-overdue-invoices' });
  await medicalAidQueue.upsertJobScheduler('poll-claim-status', { every: 24 * 60 * 60 * 1000 }, { name: 'poll-claim-status' });
  // Webhooks are authoritative; this low-frequency inquiry reconciles a
  // pending request when a webhook is delayed or unavailable.
  await paymentRequestQueue.upsertJobScheduler('poll-payment-requests', { every: 30 * 1000 }, { name: 'poll-payment-requests' });

  console.log('All workers registered');
}

process.once('SIGTERM', () => {
  void prisma.$disconnect().finally(() => process.exit(0));
});
process.once('SIGINT', () => {
  void prisma.$disconnect().finally(() => process.exit(0));
});

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
