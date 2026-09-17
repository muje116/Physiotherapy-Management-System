import net from 'node:net';
import { redisConnection } from './redis';

const idleHandles: NodeJS.Timeout[] = [];

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
    idleHandles.push(setInterval(() => {}, 60 * 60 * 1000));
    return;
  }

  await import('./jobs/reminder.jobs');
  await import('./jobs/invoice.jobs');
  await import('./jobs/report.jobs');
  await import('./jobs/medical-aid.jobs');
  const { reminderQueue, invoiceQueue, medicalAidQueue } = await import('./queues');

  // Register repeatable jobs
  await reminderQueue.upsertJobScheduler('send-appointment-reminder', { every: 15 * 60 * 1000 }, { name: 'send-appointment-reminder' });
  await reminderQueue.upsertJobScheduler('reengagement', { every: 24 * 60 * 60 * 1000 }, { name: 'reengagement' });
  await invoiceQueue.upsertJobScheduler('flag-overdue-invoices', { every: 24 * 60 * 60 * 1000 }, { name: 'flag-overdue-invoices' });
  await medicalAidQueue.upsertJobScheduler('poll-claim-status', { every: 24 * 60 * 60 * 1000 }, { name: 'poll-claim-status' });

  console.log('All workers registered');
}

main().catch(console.error);
