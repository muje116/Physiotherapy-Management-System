import { Queue } from 'bullmq';
import { redisConnection } from '../redis';

export { redisConnection };

export const reminderQueue = new Queue('reminders', { connection: redisConnection });
export const invoiceQueue = new Queue('invoices', { connection: redisConnection });
export const reportQueue = new Queue('reports', { connection: redisConnection });
export const medicalAidQueue = new Queue('medical-aid', { connection: redisConnection });
