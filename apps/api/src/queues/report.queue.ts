import { Queue } from 'bullmq';
import { redisProducerConnection } from './redis';

export const reportQueue = new Queue('reports', {
  connection: redisProducerConnection,
});
