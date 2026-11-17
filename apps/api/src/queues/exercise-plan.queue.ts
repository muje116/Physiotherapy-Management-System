import { Queue } from 'bullmq';
import { redisProducerConnection } from './redis';

export const exercisePlanQueue = new Queue('exercise-plans', {
  connection: redisProducerConnection,
});
