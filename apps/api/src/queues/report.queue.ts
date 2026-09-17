import { Queue } from 'bullmq';

const redisUrl = process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : null;
const host = process.env.REDIS_HOST || redisUrl?.hostname || 'localhost';
const port = parseInt(process.env.REDIS_PORT || redisUrl?.port || '6379', 10);

export const reportQueue = new Queue('reports', {
  connection: { host, port },
});
