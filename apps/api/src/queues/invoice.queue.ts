import { Queue } from 'bullmq';
import { redisConnection } from './redis';

export const invoiceQueue = new Queue('invoices', {
  connection: redisConnection,
});
