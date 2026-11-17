import { Queue } from 'bullmq';
import { redisProducerConnection } from './redis';

export const invoiceQueue = new Queue('invoices', {
  connection: redisProducerConnection,
});
