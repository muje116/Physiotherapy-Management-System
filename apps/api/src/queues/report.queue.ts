import { Queue } from 'bullmq';
import { redisConnection } from './redis';

export const reportQueue = new Queue('reports', {
  connection: redisConnection,
});
